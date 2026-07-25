const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'boardly-dev-secret';

// Express middleware: verify JWT from Authorization header
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Socket.IO middleware: verify JWT from handshake auth
const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return next(new Error('User not found'));
    }
    socket.user = result.rows[0];
    next();
  } catch (err) {
    return next(new Error('Invalid token'));
  }
};

module.exports = {
  verifyToken,
  socketAuth,
  JWT_SECRET,
};
