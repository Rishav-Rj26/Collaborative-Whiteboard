const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { dummyAuth, socketAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // For dev, allow all
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(dummyAuth);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', user: req.user });
});

io.use(socketAuth);

const DATA_DIR = path.join(__dirname, 'data');
const BOARDS_FILE = path.join(DATA_DIR, 'boards.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Load initial boards from file
let boards = {};
if (fs.existsSync(BOARDS_FILE)) {
  try {
    const data = fs.readFileSync(BOARDS_FILE, 'utf-8');
    boards = JSON.parse(data);
  } catch (err) {
    console.error('Failed to load boards.json:', err);
  }
}

// Persist boards periodically
const saveBoards = () => {
  fs.writeFile(BOARDS_FILE, JSON.stringify(boards), (err) => {
    if (err) console.error('Failed to save boards.json:', err);
  });
};

// Debounce save function
let saveTimeout = null;
const requestSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveBoards, 3000);
};

const getRoomUsers = async (boardId) => {
  const sockets = await io.in(boardId).fetchSockets();
  return sockets.map(s => s.user);
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

  socket.on('join-board', async (boardId) => {
    socket.join(boardId);
    socket.boardId = boardId;

    if (!boards[boardId]) {
      boards[boardId] = { elements: [] };
      requestSave();
    }

    // Send board state
    socket.emit('board-state', boards[boardId].elements);
    
    // Broadcast active users
    const users = await getRoomUsers(boardId);
    io.in(boardId).emit('active-users', users);
  });

  socket.on('update-element', (data) => {
    const { boardId, element } = data;
    if (!boards[boardId]) return;

    const existingIndex = boards[boardId].elements.findIndex(e => e.id === element.id);
    if (existingIndex !== -1) {
      boards[boardId].elements[existingIndex] = element;
    } else {
      boards[boardId].elements.push(element);
    }
    requestSave();

    socket.to(boardId).emit('update-element', {
      userId: socket.user.id,
      element
    });
  });

  socket.on('set-elements', (data) => {
    const { boardId, elements } = data;
    if (!boards[boardId]) return;

    boards[boardId].elements = elements;
    requestSave();

    socket.to(boardId).emit('board-state', elements);
  });

  socket.on('delete-element', (data) => {
    const { boardId, elementId } = data;
    if (!boards[boardId]) return;

    boards[boardId].elements = boards[boardId].elements.filter(e => e.id !== elementId);
    requestSave();

    socket.to(boardId).emit('delete-element', elementId);
  });

  socket.on('clear-canvas', (boardId) => {
    if (boards[boardId]) {
      boards[boardId].elements = [];
      requestSave();
      io.in(boardId).emit('board-state', []);
    }
  });

  socket.on('cursor-move', (data) => {
    const { boardId, cursor } = data;
    socket.to(boardId).volatile.emit('cursor-move', {
      userId: socket.user.id,
      name: socket.user.name,
      ...cursor
    });
  });

  socket.on('chat-message', (data) => {
    const { boardId, text } = data;
    const message = {
      id: Date.now().toString(),
      userId: socket.user.id,
      name: socket.user.name,
      text,
      timestamp: new Date().toISOString()
    };
    // Broadcast to others
    socket.to(boardId).emit('chat-message', message);
    // Send back to sender for confirmation/display
    socket.emit('chat-message', message);
  });

  socket.on('disconnect', async () => {
    if (socket.boardId) {
      const users = await getRoomUsers(socket.boardId);
      io.in(socket.boardId).emit('active-users', users);
      
      // Emit cursor remove
      socket.to(socket.boardId).emit('cursor-remove', socket.user.id);
    }
    console.log(`User disconnected: ${socket.user.name}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
