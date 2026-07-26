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
const upload = multer({ storage });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for larger boards

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
const deleteElement = async (elementId) => {
  await db.query('DELETE FROM elements WHERE id = $1', [elementId]);
};

// Helper: delete all elements for a board
const clearBoardElements = async (boardId) => {
  await db.query('DELETE FROM elements WHERE board_id = $1', [boardId]);
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.user.id})`);

  socket.on('join-board', async (boardId) => {
    socket.join(boardId);
    socket.boardId = boardId;

    // Auto-add user as member if not already (for shared links)
    try {
      const existing = await db.query(
        'SELECT * FROM board_members WHERE board_id = $1 AND user_id = $2',
        [boardId, socket.user.id]
      );
      if (existing.rows.length === 0) {
        // Check board exists first
        const board = await db.query('SELECT id FROM boards WHERE id = $1', [boardId]);
        if (board.rows.length > 0) {
          await db.query(
            'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
            [boardId, socket.user.id, 'editor']
          );
          socket.role = 'editor';
        }
      } else {
        socket.role = existing.rows[0].role;
      }
    } catch (err) {
      // Board might not exist in DB yet (legacy boards) — that's ok
      console.error('Auto-join check failed:', err.message);
      socket.role = 'editor'; // fallback
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
    if (socket.role === 'viewer') return;
    const { boardId, element } = data;

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

  socket.on('set-elements', async (data) => {
    if (socket.role === 'viewer') return;
    const { boardId, elements } = data;

    // Replace all elements in DB
    try {
      await clearBoardElements(boardId);
      for (const el of elements) {
        await upsertElement(boardId, el);
      }
    } catch (err) {
      console.error('Failed to set elements:', err.message);
    }

    socket.to(boardId).emit('board-state', elements);
  });

  socket.on('delete-element', async (data) => {
    if (socket.role === 'viewer') return;
    const { boardId, elementId } = data;

    deleteElement(elementId).catch(err =>
      console.error('Failed to delete element:', err.message)
    );

    socket.to(boardId).emit('delete-element', elementId);
  });

  socket.on('clear-canvas', async (boardId) => {
    if (socket.role === 'viewer') return;
    clearBoardElements(boardId).catch(err =>
      console.error('Failed to clear elements:', err.message)
    );
    io.in(boardId).emit('board-state', []);
  });

  socket.on('cursor-move', (data) => {
    if (socket.role === 'viewer') return;
    const { boardId, cursor } = data;
    socket.to(boardId).volatile.emit('cursor-move', {
      userId: socket.user.id,
      name: socket.user.name,
      ...cursor
    });
  });

  socket.on('laser-draw', (data) => {
    if (socket.role === 'viewer') return;
    const { boardId, laserPoint } = data;
    socket.to(boardId).volatile.emit('laser-draw', {
      userId: socket.user.id,
      name: socket.user.name,
      ...laserPoint
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
    socket.to(boardId).emit('chat-message', message);
    socket.emit('chat-message', message);
  });

  // Pages events
  socket.on('add-page', async (data) => {
    if (socket.role === 'viewer') return;
    const { boardId, title, orderIndex } = data;
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
    if (socket.role === 'viewer') return;
    const { boardId, pageId } = data;
    try {
      await db.query('DELETE FROM pages WHERE id = $1', [pageId]);
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
