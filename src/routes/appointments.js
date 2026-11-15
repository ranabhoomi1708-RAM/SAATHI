// appointments.js – appointment routes per contract

const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { computeStats } = require('../lib/doselogic');

const router = express.Router({ mergeParams: true });

/** Helper to parse JSON columns safely */
function parseJson(col) {
  try { return JSON.parse(col); } catch { return []; }
}

/** GET / – list appointments */
router.get('/', requireCircle('read'), (req, res) => {
  const statusFilter = req.query.status || 'upcoming';
  let sql = `SELECT * FROM appointments WHERE circle_id = ?`;
  const params = [req.cid];
  if (statusFilter !== 'all') {
    sql += ` AND status = ?`;
    params.push(statusFilter);
  }
  sql += ` ORDER BY datetime(datetime) ASC`;
  const rows = db.prepare(sql).all(...params);
  const appointments = rows.map(a => ({
    ...a,
    questions: parseJson(a.questions)
  }));
  res.json({ appointments });
});

/** POST / – create appointment */
router.post('/', requireCircle('edit'), (req, res) => {
  const a = req.body;
  const insert = db.prepare(`INSERT INTO appointments (circle_id, doctor, specialty, location, datetime, purpose, questions, accompanied_by, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const result = insert.run(
    req.cid,
    a.doctor,
    a.specialty || null,
    a.location || null,
    a.datetime,
    a.purpose || null,
    JSON.stringify(a.questions || []),
    a.accompanied_by || null,
    'upcoming',
    req.ctx.label || null
  );
  const aid = result.lastInsertRowid;
  logActivity(req.cid, req.ctx.label, 'appointment_added', JSON.stringify({ appointmentId: aid }));
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(aid);
  appointment.questions = parseJson(appointment.questions);
  res.status(201).json({ appointment });
});

/** PATCH /:aid – update appointment */
router.patch('/:aid', requireCircle('edit'), (req, res) => {
  const aid = Number(req.params.aid);
  const updates = req.body;
  const cols = [];
  const vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'questions') {
      cols.push(`${k} = ?`);
      vals.push(JSON.stringify(v));
    } else {
      cols.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (cols.length === 0) return res.status(400).json({ error: 'No fields to update' });
  const stmt = db.prepare(`UPDATE appointments SET ${cols.join(', ')} WHERE id = ? AND circle_id = ?`);
  stmt.run(...vals, aid, req.cid);
  logActivity(req.cid, req.ctx.label, 'appointment_updated', JSON.stringify({ appointmentId: aid }));
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(aid);
  appointment.questions = parseJson(appointment.questions);
  res.json({ appointment });
});

/** DELETE /:aid – cancel appointment */
router.delete('/:aid', requireCircle('edit'), (req, res) => {
  const aid = Number(req.params.aid);
  db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ? AND circle_id = ?`).run(aid, req.cid);
  logActivity(req.cid, req.ctx.label, 'appointment_cancelled', JSON.stringify({ appointmentId: aid }));
  res.json({ ok: true });
});

/** POST /:aid/claim – claim appointment */
router.post('/:aid/claim', requireCircle('edit'), (req, res) => {
  const aid = Number(req.params.aid);
  db.prepare(`UPDATE appointments SET accompanied_by = ? WHERE id = ? AND circle_id = ?`).run(req.ctx.label, aid, req.cid);
  logActivity(req.cid, req.ctx.label, 'appointment_claimed', JSON.stringify({ appointmentId: aid }));
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(aid);
  appointment.questions = parseJson(appointment.questions);
  res.json({ appointment });
});

/** POST /:aid/complete – mark done */
router.post('/:aid/complete', requireCircle('edit'), (req, res) => {
  const aid = Number(req.params.aid);
  const notes = req.body.outcome_notes || null;
  db.prepare(`UPDATE appointments SET status = 'done', outcome_notes = ?, accompanied_by = COALESCE(accompanied_by, ?) WHERE id = ? AND circle_id = ?`)
    .run(notes, req.ctx.label, aid, req.cid);
  logActivity(req.cid, req.ctx.label, 'appointment_done', JSON.stringify({ appointmentId: aid }));
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(aid);
  appointment.questions = parseJson(appointment.questions);
  res.json({ appointment });
});

/** GET /:aid/prep – preparation info */
router.get('/:aid/prep', requireCircle('read'), async (req, res) => {
  const aid = Number(req.params.aid);
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ? AND circle_id = ?').get(aid, req.cid);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  appointment.questions = parseJson(appointment.questions);

  // stats for past 14 days
  const stats = computeStats(req.cid, 14);

  // latest mood per date for past 14 days
  const moodsRows = db.prepare(`SELECT * FROM mood_checkins WHERE circle_id = ? ORDER BY date DESC LIMIT 14`).all(req.cid);
  const mood_last = moodsRows.map(r => ({ date: r.date, mood: r.mood }));
  const mood_avg = moodsRows.reduce((sum, r) => sum + r.mood, 0) / (moodsRows.length || 1);

  // active medications list (name, dosage, times, instructions)
  const medsRows = db.prepare(`SELECT name, dosage, times, instructions FROM medications WHERE circle_id = ? AND active = 1`).all(req.cid);
  const medications = medsRows.map(m => ({
    name: m.name,
    dosage: m.dosage,
    times: (() => { try { return JSON.parse(m.times); } catch { return []; } })(),
    instructions: m.instructions
  }));

  // low stock meds
  const low_stock = db.prepare(`SELECT name, pills_left FROM medications WHERE circle_id = ? AND active = 1 AND pills_left <= refill_threshold`).all(req.cid);

  // Prepare Gemini prompt (omitted actual call – fallback).
  const fallbackQuestions = [];
  const source = 'fallback';

  res.json({
    appointment,
    questions: fallbackQuestions,
    source,
    summary: {
      period_days: 14,
      adherence_pct: stats.adherence_pct,
      missed: stats.missed_by_med,
      mood_avg,
      mood_last,
      medications,
      low_stock
    }
  });
});

module.exports = router;
