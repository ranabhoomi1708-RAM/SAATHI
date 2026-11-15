const express = require('express');
const db = require('../db');
const { authRequired, requireCircle, readToken } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router({ mergeParams: true });

// GET '/' – list members based on requester role
router.get('/', requireCircle('read'), (req, res) => {
  const role = req.ctx.role;
  let sql = `SELECT m.id, u.name, m.relation, m.role, m.status, u.phone, u.email, m.notify_missed, m.notify_upcoming, m.notify_appointments
    FROM members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = ?`;
  const params = [req.cid];

  if (role === 'admin') {
    // admin sees all members including revoked, with email and notify flags
  } else if (role === 'editor') {
    sql += ` AND m.status != 'revoked'`;
  } else {
    // viewer or elder: only active members, limited fields
    sql = `SELECT m.id, u.name, m.relation, m.role, u.phone FROM members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = ? AND m.status = 'active'`;
  }

  sql += ` ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, m.id`;
  const rows = db.prepare(sql).all(...params);
  res.json({ members: rows });
});

// PATCH '/me/prefs' – update notification preferences for the calling user
router.patch('/me/prefs', requireCircle('read'), (req, res) => {
  const token = readToken(req);
  if (!token || token.kind !== 'user') return res.status(403).json({ error: 'Only users can change preferences' });
  const memberId = req.ctx.memberId;
  const allowed = ['notify_missed', 'notify_upcoming', 'notify_appointments'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      const val = Number(req.body[key]);
      if (val !== 0 && val !== 1) return res.status(400).json({ error: `${key} must be 0 or 1` });
      updates.push(`${key} = ?`);
      params.push(val);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No preferences provided' });
  const stmt = db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ? AND circle_id = ?`);
  stmt.run(...params, memberId, req.cid);
  res.json({ ok: true });
});

// DELETE '/me' – user leaves the circle (or revokes themselves)
router.delete('/me', requireCircle('read'), (req, res) => {
  const token = readToken(req);
  if (!token || token.kind !== 'user') return res.status(403).json({ error: 'Only users can leave a circle' });
  const memberId = req.ctx.memberId;
  const member = db.prepare('SELECT role FROM members WHERE id = ? AND circle_id = ?').get(memberId, req.cid);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (member.role === 'admin') {
    const otherAdmins = db.prepare('SELECT COUNT(*) AS cnt FROM members WHERE circle_id = ? AND role = "admin" AND status = "active" AND id != ?').get(req.cid, memberId).cnt;
    if (otherAdmins === 0) return res.status(400).json({ error: 'You are the only admin. Make someone else admin first.' });
  }

  db.prepare('UPDATE members SET status = "revoked" WHERE id = ? AND circle_id = ?').run(memberId, req.cid);
  logActivity(req.cid, req.ctx.label, 'left', 'User left the circle');
  res.json({ ok: true });
});

// PATCH '/:mid' – admin updates a member
router.patch('/:mid', requireCircle('admin'), (req, res) => {
  const mid = Number(req.params.mid);
  const member = db.prepare('SELECT id, role, status FROM members WHERE id = ? AND circle_id = ?').get(mid, req.cid);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const allowedRoles = ['admin', 'editor', 'viewer'];
  const allowedStatus = ['active', 'revoked'];
  const updates = [];
  const params = [];
  let activityKind = 'member_updated';

  if (req.body.role && allowedRoles.includes(req.body.role)) {
    updates.push('role = ?');
    params.push(req.body.role);
  }
  if (req.body.status && allowedStatus.includes(req.body.status)) {
    updates.push('status = ?');
    params.push(req.body.status);
    if (member.status === 'pending' && req.body.status === 'active') {
      activityKind = 'member_approved';
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  // Ensure we are not removing the last active admin
  if ((member.role === 'admin' && member.status === 'active') && (req.body.role && req.body.role !== 'admin' || req.body.status && req.body.status === 'revoked')) {
    const otherAdmins = db.prepare('SELECT COUNT(*) AS cnt FROM members WHERE circle_id = ? AND role = "admin" AND status = "active" AND id != ?').get(req.cid, mid).cnt;
    if (otherAdmins === 0) return res.status(400).json({ error: 'The circle needs at least one admin' });
  }

  const stmt = db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ? AND circle_id = ?`);
  stmt.run(...params, mid, req.cid);

  const targetUser = db.prepare('SELECT u.name FROM users u JOIN members m ON u.id = m.user_id WHERE m.id = ?').get(mid);
  const detail = `${targetUser.name} → ${req.body.role || member.role}/${req.body.status || member.status}`;
  logActivity(req.cid, req.ctx.label, activityKind, detail);

  res.json({ member: { id: mid, role: req.body.role || member.role, status: req.body.status || member.status } });
});

module.exports = router;
