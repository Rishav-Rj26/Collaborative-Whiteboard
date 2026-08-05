const VALID_ROLES = new Set(['owner', 'editor', 'viewer']);

const canEdit = (role) => role === 'owner' || role === 'editor';

const getBoardRole = async (query, boardId, userId) => {
  const result = await query(
    'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  return result.rows[0]?.role ?? null;
};

const requireBoardRole = async (req, res, next) => {
  try {
    const role = await getBoardRole(req.app.get('dbQuery'), req.params.id, req.user.id);
    if (!role) return res.status(403).json({ error: 'You do not have access to this board' });
    req.boardRole = role;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { VALID_ROLES, canEdit, getBoardRole, requireBoardRole };
