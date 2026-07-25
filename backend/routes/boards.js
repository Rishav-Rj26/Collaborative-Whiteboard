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

module.exports = router;
