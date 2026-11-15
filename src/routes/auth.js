const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { setCookie, readToken, authRequired, revokeToken } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router({ mergeParams: true });

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes.' }
});

const elderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes.' }
});

function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

router.post('/register', authLimiter, (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const phone = req.body.phone ? String(req.body.phone).trim() : null;

  if (name.length < 1 || name.length > 80) return res.status(400).json({ error: 'Invalid name' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (password.length < 8) return res.status(400).json({ error: 'Password too short' });
  if (phone && phone.length > 20) return res.status(400).json({ error: 'Phone too long' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (exists) return res.status(409).json({ error: 'This email is already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users(name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run(name, email, phone, hash);
  const uid = info.lastInsertRowid;
  setCookie(res, { kind: 'user', uid }, 7);
  res.status(201).json({ user: { id: uid, name, email } });
});

router.post('/login', authLimiter, (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const row = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  setCookie(res, { kind: 'user', uid: row.id }, 7);
  res.json({ user: { id: row.id, name: row.name, email: row.email } });
});

router.post('/elder-login', elderLimiter, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const pin = String(req.body.pin || '').trim();
  const circle = db.prepare('SELECT * FROM circles WHERE join_code = ?').get(code);
  if (!circle) return res.status(401).json({ error: 'Wrong code or PIN' });
  if (!bcrypt.compareSync(pin, circle.elder_pin_hash)) {
    return res.status(401).json({ error: 'Wrong code or PIN' });
  }
  setCookie(res, { kind: 'elder', cid: circle.id }, 30);
  logActivity(circle.id, `${circle.elder_name} (self)`, 'elder_login', 'Signed in on a device');
  res.json({ circle: { id: circle.id, elder_name: circle.elder_name, language: circle.language } });
});

router.post('/logout', (req, res) => {
  const t = req.cookies && req.cookies.token;
  if (t) revokeToken(t);
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in' });

  if (token.kind === 'user') {
    const user = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(token.uid);
    if (!user) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'Please sign in' });
    }
    const circles = db.prepare(`SELECT c.id, c.elder_name, m.role, m.status, m.relation FROM members m JOIN circles c ON c.id=m.circle_id WHERE m.user_id = ? AND m.status IN ('active','pending')`).all(user.id);
    return res.json({ kind: 'user', user, circles });
  } else if (token.kind === 'elder') {
    const circle = db.prepare('SELECT id, elder_name, language FROM circles WHERE id = ?').get(token.cid);
    if (!circle) return res.status(401).json({ error: 'Please sign in' });
    return res.json({ kind: 'elder', circle });
  } else {
    return res.status(401).json({ error: 'Please sign in' });
  }
});

module.exports = router;
