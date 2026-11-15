const jwt = require('jsonwebtoken');
const db = require('../db');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CAN = {
  read: ['admin', 'editor', 'viewer', 'elder'],
  log: ['admin', 'editor', 'elder'],
  edit: ['admin', 'editor'],
  admin: ['admin']
};
const revokedTokens = new Set();
function revokeToken(tokenStr) {
  if (tokenStr) revokedTokens.add(tokenStr);
}
function signToken(payload, days) { return jwt.sign(payload, SECRET, { expiresIn: days + 'd' }); }
function setCookie(res, payload, days) {
  res.cookie('token', signToken(payload, days), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: days * 86400000
  });
}
function readToken(req) {
  const t = req.cookies && req.cookies.token;
  if (!t || revokedTokens.has(t)) return null;
  try { return jwt.verify(t, SECRET); } catch (e) { return null; }
}
function authRequired(req, res, next) {
  const p = readToken(req);
  if (!p) return res.status(401).json({ error: 'Please sign in' });
  req.token = p; next();
}
function requireCircle(action = 'read') {
  return (req, res, next) => {
    const p = readToken(req);
    if (!p) return res.status(401).json({ error: 'Please sign in' });
    const cid = parseInt(req.params.cid, 10);
    if (!cid) return res.status(400).json({ error: 'Bad circle id' });
    const circle = db.prepare('SELECT id, elder_name FROM circles WHERE id=?').get(cid);
    if (!circle) return res.status(404).json({ error: 'Circle not found' });
    let ctx;
    if (p.kind === 'elder') {
      if (p.cid !== cid) return res.status(403).json({ error: 'Not allowed' });
      ctx = { kind: 'elder', circleId: cid, role: 'elder', label: circle.elder_name + ' (self)' };
    } else if (p.kind === 'user') {
      const row = db.prepare(`SELECT m.id, m.role, m.relation, u.name FROM members m JOIN users u ON u.id=m.user_id
        WHERE m.circle_id=? AND m.user_id=? AND m.status='active'`).get(cid, p.uid);
      if (!row) return res.status(403).json({ error: 'You do not have access to this circle' });
      ctx = { kind: 'user', userId: p.uid, memberId: row.id, circleId: cid, role: row.role,
              label: row.name + (row.relation ? ` (${row.relation})` : '') };
    } else return res.status(401).json({ error: 'Please sign in' });
    if (!CAN[action].includes(ctx.role)) return res.status(403).json({ error: 'You do not have permission to do this' });
    req.ctx = ctx; req.cid = cid; next();
  };
}
module.exports = { signToken, setCookie, readToken, authRequired, requireCircle, CAN, revokeToken };