require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const { verifyToken, socketAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { canEdit, getBoardRole } = require('./lib/boardAccess');
const { validChatMessage } = require('./lib/validation');

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
app.set('dbQuery', db.query);

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/upload', verifyToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

// Socket.IO auth middleware
io.use(socketAuth);

// Helper: get active users in a room
const getRoomUsers = async (boardId) => {
  const sockets = await io.in(boardId).fetchSockets();
  return sockets.map(s => ({ id: s.user.id, name: s.user.name }));
};

// Helper: load board elements from DB
const loadBoardElements = async (boardId) => {
  const result = await db.query(
    'SELECT id, page_id, data FROM elements WHERE board_id = $1 ORDER BY created_at ASC',
    [boardId]
  );
  return result.rows.map(r => ({ id: r.id, pageId: r.page_id, ...r.data }));
};

// Helper: upsert an element into DB
const upsertElement = async (boardId, element) => {
  const { id, pageId, ...data } = element;
  await db.query(
    `INSERT INTO elements (id, board_id, page_id, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET data = $4, page_id = $3, updated_at = NOW()`,
    [id, boardId, pageId || null, JSON.stringify(data)]
  );
};

// Helper: delete an element from DB
const deleteElement = async (boardId, elementId) => {
  await db.query('DELETE FROM elements WHERE id = $1 AND board_id = $2', [elementId, boardId]);
};

// Helper: delete all elements for a board
const clearBoardElements = async (boardId) => {
  await db.query('DELETE FROM elements WHERE board_id = $1', [boardId]);
};

const socketCanAccessBoard = (socket, boardId, needsEdit = false) =>
  socket.boardId === boardId && socket.rooms.has(boardId) && (!needsEdit || canEdit(socket.role));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

  socket.on('join-board', async (boardId) => {
    try {
      const role = await getBoardRole(db.query, boardId, socket.user.id);
      if (!role) {
        socket.emit('board-access-denied');
        return;
      }
      if (socket.boardId && socket.boardId !== boardId) socket.leave(socket.boardId);
      socket.join(boardId);
      socket.boardId = boardId;
      socket.role = role;
    } catch (err) {
      console.error('Board access check failed:', err.message);
      socket.emit('board-access-denied');
      return;
    }

    socket.emit('role', socket.role);

    // Send board pages
    try {
      const pagesRes = await db.query('SELECT * FROM pages WHERE board_id = $1 ORDER BY order_index ASC', [boardId]);
      socket.emit('board-pages', pagesRes.rows);
    } catch (err) {
      console.error('Failed to load board pages:', err.message);
    }

    // Send board state from DB
    try {
      const elements = await loadBoardElements(boardId);
      socket.emit('board-state', elements);
    } catch (err) {
      console.error('Failed to load board elements:', err.message);
      socket.emit('board-state', []);
    }

    // Broadcast active users
    const users = await getRoomUsers(boardId);
    io.in(boardId).emit('active-users', users);
  });

  socket.on('update-element', async (data) => {
    const { boardId, element } = data;
    if (!socketCanAccessBoard(socket, boardId, true) || !element?.id) return;

    // Persist to DB (fire and forget for speed, errors are logged)
    upsertElement(boardId, element).catch(err =>
      console.error('Failed to upsert element:', err.message)
    );

    // Update board's updated_at
    db.query('UPDATE boards SET updated_at = NOW() WHERE id = $1', [boardId]).catch(() => {});

    socket.to(boardId).emit('update-element', {
      userId: socket.user.id,
      element
    });
  });

  socket.on('draw-progress', (data) => {
    const { boardId, element } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    
    // Broadcast immediately without writing to DB
    socket.to(boardId).volatile.emit('update-element', {
      userId: socket.user.id,
      element
    });
  });

  socket.on('set-elements', async (data) => {
    const { boardId, elements } = data;
    if (!socketCanAccessBoard(socket, boardId, true) || !Array.isArray(elements)) return;

    // Replace all elements atomically so a failed update cannot leave a partial board.
    try {
      await db.transaction(async (client) => {
        await client.query('DELETE FROM elements WHERE board_id = $1', [boardId]);
        for (const el of elements) {
          const { id, pageId, ...data } = el;
          await client.query(
            'INSERT INTO elements (id, board_id, page_id, data) VALUES ($1, $2, $3, $4)',
            [id, boardId, pageId || null, JSON.stringify(data)]
          );
        }
      });
    } catch (err) {
      console.error('Failed to set elements:', err.message);
    }

    socket.to(boardId).emit('board-state', elements);
  });

  socket.on('delete-element', async (data) => {
    const { boardId, elementId } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;

    deleteElement(boardId, elementId).catch(err =>
      console.error('Failed to delete element:', err.message)
    );

    socket.to(boardId).emit('delete-element', elementId);
  });

  socket.on('clear-canvas', async (boardId) => {
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    clearBoardElements(boardId).catch(err =>
      console.error('Failed to clear elements:', err.message)
    );
    io.in(boardId).emit('board-state', []);
  });

  socket.on('save-thumbnail', async (data) => {
    const { boardId, thumbnail } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    try {
      await db.query('UPDATE boards SET thumbnail = $1, updated_at = NOW() WHERE id = $2', [thumbnail, boardId]);
    } catch (err) {
      console.error('Failed to save thumbnail:', err.message);
    }
  });

  socket.on('cursor-move', (data) => {
    const { boardId, cursor } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    socket.to(boardId).volatile.emit('cursor-move', {
      userId: socket.user.id,
      name: socket.user.name,
      ...cursor
    });
  });

  socket.on('laser-draw', (data) => {
    const { boardId, laserPoint } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    socket.to(boardId).volatile.emit('laser-draw', {
      userId: socket.user.id,
      name: socket.user.name,
      ...laserPoint
    });
  });

  socket.on('chat-message', (data) => {
    const { boardId, text } = data;
    if (!socketCanAccessBoard(socket, boardId) || !validChatMessage(text)) return;
    const message = {
      id: Date.now().toString(),
      userId: socket.user.id,
      name: socket.user.name,
      text,
      timestamp: new Date().toISOString()
    };
    socket.to(boardId).emit('chat-message', message);
    socket.emit('chat-message', message);
  });

  // Pages events
  socket.on('add-page', async (data) => {
    const { boardId, title, orderIndex } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    try {
      const res = await db.query(
        'INSERT INTO pages (board_id, title, order_index) VALUES ($1, $2, $3) RETURNING *',
        [boardId, title || 'New Page', orderIndex || 0]
      );
      io.in(boardId).emit('page-added', res.rows[0]);
    } catch (err) {
      console.error('Failed to add page:', err.message);
    }
  });

  socket.on('delete-page', async (data) => {
    const { boardId, pageId } = data;
    if (!socketCanAccessBoard(socket, boardId, true)) return;
    try {
      await db.query('DELETE FROM pages WHERE id = $1 AND board_id = $2', [pageId, boardId]);
      io.in(boardId).emit('page-deleted', pageId);
    } catch (err) {
      console.error('Failed to delete page:', err.message);
    }
  });

  socket.on('disconnect', async () => {
    if (socket.boardId) {
      const users = await getRoomUsers(socket.boardId);
      io.in(socket.boardId).emit('active-users', users);
      socket.to(socket.boardId).emit('cursor-remove', socket.user.id);
    }
    console.log(`User disconnected: ${socket.user.name}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
