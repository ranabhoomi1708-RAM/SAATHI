// mood.js – mood check-in routes per contract

const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { localParts } = require('../lib/time');

const router = express.Router({ mergeParams: true });

/** Helper to parse integer safely */
function toInt(val, def) {
  const n = Number(val);
  return isNaN(n) ? def : n;
}

/** POST / – log mood */
router.post('/', requireCircle('log'), (req, res) => {
  const mood = toInt(req.body.mood, null);
  if (mood === null || mood < 1 || mood > 5) {
    return res.status(400).json({ error: 'Invalid mood' });
  }
  const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 200) : null;
  const date = localParts().date;
  const result = db.prepare(`INSERT INTO mood_checkins (circle_id, date, mood, note) VALUES (?,?,?,?)`).run(req.cid, date, mood, note);
  const id = result.lastInsertRowid;
  logActivity(req.cid, req.ctx.label, 'mood_checkin', JSON.stringify({ moodId: id }));
  const row = db.prepare('SELECT * FROM mood_checkins WHERE id = ?').get(id);
  res.status(201).json({ mood: row });
});

/** GET / – retrieve recent moods */
router.get('/', requireCircle('read'), (req, res) => {
  const days = Math.min(60, toInt(req.query.days, 14));
  const endDate = localParts().date;
  const startDate = db.prepare('SELECT date FROM mood_checkins WHERE circle_id = ? ORDER BY date DESC LIMIT 1').get(req.cid);
  // Build date range using time library
  const { dateRange } = require('../lib/time');
  const range = dateRange(endDate, days);
  const placeholders = range.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM mood_checkins WHERE circle_id = ? AND date IN (${placeholders}) ORDER BY date ASC`).all(req.cid, ...range);
  // Keep only latest per date (though there should be at most one per date)
  const moods = rows.map(r => ({ date: r.date, mood: r.mood, note: r.note, created_at: r.created_at }));
  res.json({ moods });
});

module.exports = router;
