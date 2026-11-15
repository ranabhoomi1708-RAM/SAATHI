const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authRequired, requireCircle, readToken } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router({ mergeParams: true });

// Helper to generate an 8‑character join code
function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    // ensure uniqueness
  } while (db.prepare('SELECT 1 FROM circles WHERE join_code = ?').get(code));
  return code;
}

function publicCircle(row, role, isAdmin) {
  const base = {
    id: row.id,
    elder_name: row.elder_name,
    elder_age: row.elder_age,
    elder_email: row.elder_email,
    language: row.language,
    blood_group: row.blood_group,
    conditions: row.conditions,
    allergies: row.allergies,
    doctor_name: row.doctor_name,
    doctor_phone: row.doctor_phone,
    emergency_notes: row.emergency_notes,
    my_role: role
  };
  if (isAdmin) base.join_code = row.join_code;
  return base;
}

// Rate limiter for join requests
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes.' }
});

// POST / – create a new circle (admin user)
router.post('/', authRequired, (req, res) => {
  const token = readToken(req);
  if (!token || token.kind !== 'user') return res.status(403).json({ error: 'Only users may create circles' });

  const {
    elder_name,
    elder_age,
    elder_email,
    language = 'en',
    blood_group,
    conditions,
    allergies,
    doctor_name,
    doctor_phone,
    emergency_notes,
    elder_pin,
    relation: rawRelation
  } = req.body;
  const relation = (rawRelation || 'Family').trim();

  if (!elder_name || elder_name.length > 80) return res.status(400).json({ error: 'Invalid elder_name' });
  if (!/^\d{4}$/.test(elder_pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  if (!relation || relation.length > 40) return res.status(400).json({ error: 'Invalid relation' });
  if (!['en', 'hi'].includes(language)) return res.status(400).json({ error: 'Invalid language' });
  if (elder_age !== undefined && (isNaN(elder_age) || elder_age < 1 || elder_age > 120)) return res.status(400).json({ error: 'Invalid elder_age' });
  if (elder_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(elder_email)) return res.status(400).json({ error: 'Invalid elder_email' });

  const pinHash = bcrypt.hashSync(elder_pin, 8);
  const join_code = generateCode();

  const insertCircle = db.prepare(`INSERT INTO circles(elder_name,elder_age,elder_email,language,join_code,elder_pin_hash,blood_group,conditions,allergies,doctor_name,doctor_phone,emergency_notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const circleInfo = insertCircle.run(
    elder_name,
    elder_age || null,
    elder_email || null,
    language,
    join_code,
    pinHash,
    blood_group || null,
    conditions || null,
    allergies || null,
    doctor_name || null,
    doctor_phone || null,
    emergency_notes || null,
    token.uid
  );
  const cid = circleInfo.lastInsertRowid;

  // Add creator as admin member
  db.prepare('INSERT INTO members(circle_id,user_id,role,status,relation) VALUES (?,?,?,?,?)')
    .run(cid, token.uid, 'admin', 'active', relation);

  logActivity(cid, `${req.body.name || ''} (${relation})`, 'circle_created', `Created the circle for ${elder_name}`);

  const row = db.prepare('SELECT * FROM circles WHERE id = ?').get(cid);
  res.status(201).json({ circle: publicCircle(row, 'admin', true) });
});

// POST /join – request to join a circle
router.post('/join', authRequired, joinLimiter, (req, res) => {
  const token = readToken(req);
  if (!token || token.kind !== 'user') return res.status(403).json({ error: 'Only users may join circles' });

  const code = String(req.body.code || '').trim().toUpperCase();
  const relation = req.body.relation ? String(req.body.relation).trim() : null;
  if (!relation) return res.status(400).json({ error: 'Relation required' });
  const requested_role = ['editor', 'viewer'].includes(req.body.requested_role) ? req.body.requested_role : 'viewer';

  const circle = db.prepare('SELECT * FROM circles WHERE join_code = ?').get(code);
  if (!circle) return res.status(404).json({ error: 'Code not found' });

  const existing = db.prepare('SELECT * FROM members WHERE circle_id = ? AND user_id = ?').get(circle.id, token.uid);
  if (existing) {
    if (existing.status === 'revoked') return res.status(403).json({ error: 'Access was removed by the circle admin' });
    return res.json({ status: existing.status, circle_name: circle.elder_name });
  }

  db.prepare('INSERT INTO members(circle_id,user_id,role,status,relation) VALUES (?,?,?,?,?)')
    .run(circle.id, token.uid, requested_role, 'pending', relation);

  const userRow = db.prepare('SELECT name FROM users WHERE id = ?').get(token.uid);
  logActivity(circle.id, `${userRow.name} (${relation})`, 'join_requested', `Asked to join as ${requested_role}`);

  res.json({ status: 'pending', circle_name: circle.elder_name });
});

// GET /:cid – get circle details (respect role)
router.get('/:cid', requireCircle('read'), (req, res) => {
  const row = db.prepare('SELECT * FROM circles WHERE id = ?').get(req.cid);
  const isAdmin = req.ctx.role === 'admin';
  res.json({ circle: publicCircle(row, req.ctx.role, isAdmin) });
});

// PATCH /:cid – update allowed fields (admin only)
router.patch('/:cid', requireCircle('admin'), (req, res) => {
  const allowed = ['elder_name','elder_age','elder_email','language','blood_group','conditions','allergies','doctor_name','doctor_phone','emergency_notes','elder_pin'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (key === 'elder_pin') {
        if (!/^\d{4}$/.test(req.body.elder_pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        updates.push('elder_pin_hash = ?');
        params.push(bcrypt.hashSync(req.body.elder_pin, 8));
      } else {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const stmt = db.prepare(`UPDATE circles SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params, req.cid);

  logActivity(req.cid, req.ctx.label, 'circle_updated', 'Circle details updated');

  const row = db.prepare('SELECT * FROM circles WHERE id = ?').get(req.cid);
  res.json({ circle: publicCircle(row, req.ctx.role, req.ctx.role === 'admin') });
});

// POST /:cid/rotate-code – generate a new join code (admin only)
router.post('/:cid/rotate-code', requireCircle('admin'), (req, res) => {
  const newCode = generateCode();
  db.prepare('UPDATE circles SET join_code = ? WHERE id = ?').run(newCode, req.cid);
  logActivity(req.cid, req.ctx.label, 'code_rotated', 'Join code rotated');
  res.json({ join_code: newCode });
});

module.exports = router;
