const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/boards — list all boards user owns or is a member of
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.id, b.title, b.owner_id, b.created_at, b.updated_at,
              bm.role,
              u.name AS owner_name,
              (SELECT COUNT(*) FROM board_members WHERE board_id = b.id) AS member_count
       FROM boards b
       JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $1
       JOIN users u ON b.owner_id = u.id
       ORDER BY b.updated_at DESC`,
      [req.user.id]
    );
    res.json({ boards: result.rows });
  } catch (err) {
    console.error('List boards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards — create a new board
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const boardTitle = title?.trim() || 'Untitled Board';

    const boardResult = await db.query(
      'INSERT INTO boards (title, owner_id) VALUES ($1, $2) RETURNING *',
      [boardTitle, req.user.id]
    );

    const board = boardResult.rows[0];

    // Add creator as owner member
    await db.query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
      [board.id, req.user.id, 'owner']
    );

    res.status(201).json({ board });
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id — delete a board (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const board = await db.query(
      'SELECT * FROM boards WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    await db.query('DELETE FROM boards WHERE id = $1', [id]);
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/:id/join — join a board as editor
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;

    // Check board exists
    const board = await db.query('SELECT * FROM boards WHERE id = $1', [id]);
    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if already a member
    const existing = await db.query(
      'SELECT * FROM board_members WHERE board_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      await db.query(
        'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
        [id, req.user.id, 'editor']
      );
    }

    res.json({ board: board.rows[0] });
  } catch (err) {
    console.error('Join board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/:id/members — list all members of a board
router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT bm.user_id, bm.role, u.name, u.email 
       FROM board_members bm
       JOIN users u ON bm.user_id = u.id
       WHERE bm.board_id = $1
       ORDER BY bm.joined_at ASC`,
      [id]
    );
    res.json({ members: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/boards/:id/members/:userId — update a member's role (owner only)
router.put('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    // Verify current user is owner
    const ownerCheck = await db.query('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [id, req.user.id]);
    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can change roles' });
    }

    // Don't let owner change their own role here
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role this way' });
    }

    await db.query('UPDATE board_members SET role = $1 WHERE board_id = $2 AND user_id = $3', [role, id, userId]);
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/:id/snapshots — get board history
router.get('/:id/snapshots', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT id, created_at FROM board_snapshots WHERE board_id = $1 ORDER BY created_at DESC', [id]);
    res.json({ snapshots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/:id/snapshots — create a snapshot
router.post('/:id/snapshots', async (req, res) => {
  try {
    const { id } = req.params;
    // Check permission (editor or owner)
    const memCheck = await db.query('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [id, req.user.id]);
    if (memCheck.rows.length === 0 || memCheck.rows[0].role === 'viewer') {
      return res.status(403).json({ error: 'Not allowed to save snapshots' });
    }

    // get all elements for this board
    const elements = await db.query('SELECT id, page_id, data FROM elements WHERE board_id = $1', [id]);
    const canvasState = elements.rows.map(r => ({ id: r.id, pageId: r.page_id, ...r.data }));

    const result = await db.query(
      'INSERT INTO board_snapshots (board_id, canvas_state) VALUES ($1, $2) RETURNING id, created_at',
      [id, JSON.stringify(canvasState)]
    );
    res.json({ snapshot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/:id/snapshots/:snapshotId/restore — restore a snapshot
router.post('/:id/snapshots/:snapshotId/restore', async (req, res) => {
  try {
    const { id, snapshotId } = req.params;
    const memCheck = await db.query('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [id, req.user.id]);
    if (memCheck.rows.length === 0 || memCheck.rows[0].role === 'viewer') {
      return res.status(403).json({ error: 'Not allowed to restore snapshots' });
    }

    const snapshot = await db.query('SELECT canvas_state FROM board_snapshots WHERE id = $1 AND board_id = $2', [snapshotId, id]);
    if (snapshot.rows.length === 0) return res.status(404).json({ error: 'Snapshot not found' });

    const elements = snapshot.rows[0].canvas_state;

    // Replace all elements
    await db.query('DELETE FROM elements WHERE board_id = $1', [id]);
    for (const el of elements) {
      const { id: elId, pageId, ...data } = el;
      await db.query(
        'INSERT INTO elements (id, board_id, page_id, data) VALUES ($1, $2, $3, $4)',
        [elId, id, pageId || null, JSON.stringify(data)]
      );
    }

    // Broadcast to connected clients using the exported io instance
    const io = req.app.get('io');
    if (io) {
      io.in(id).emit('board-state', elements);
    }

    res.json({ message: 'Snapshot restored', elements });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
