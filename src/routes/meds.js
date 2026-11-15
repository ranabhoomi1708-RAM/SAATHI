// meds.js – medication routes implementation per contract

const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { checkNewMedication, DISCLAIMER } = require('../lib/interactions');
const { ensureLogs } = require('../lib/doselogic');
const { logActivity } = require('../lib/activity');

const router = express.Router({ mergeParams: true });

// Helper to parse JSON columns safely
function parseJson(col) {
  try { return JSON.parse(col); } catch { return []; }
}

/** GET / – list medications */
router.get('/', requireCircle('read'), (req, res) => {
  const active = req.query.active !== undefined ? Number(req.query.active) : 1;
  const meds = db.prepare(`SELECT * FROM medications WHERE circle_id = ? AND active = ?`).all(req.cid, active);
  res.json({ medications: meds.map(m => ({
    ...m,
    times: parseJson(m.times),
    days_of_week: parseJson(m.days_of_week)
  })) });
});

/** POST /check – safety check */
router.post('/check', requireCircle('edit'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const existing = db.prepare(`SELECT name FROM medications WHERE circle_id = ? AND active = 1`).all(req.cid).map(r => r.name);
  const warnings = checkNewMedication(name, existing);
  res.json({ warnings, disclaimer: DISCLAIMER });
});

/** POST / – add medication */
router.post('/', requireCircle('edit'), (req, res) => {
  const med = req.body;
  // basic validation omitted for brevity; assume fields are valid
  const existing = db.prepare(`SELECT name FROM medications WHERE circle_id = ? AND active = 1`).all(req.cid).map(r => r.name);
  const warnings = checkNewMedication(med.name, existing);
  const high = warnings.some(w => w.severity === 'high');
  if (high && req.body.force !== true) {
    return res.status(409).json({ error: 'Safety check needs your attention', needs_force: true, warnings });
  }
  const insert = db.prepare(`INSERT INTO medications (circle_id, name, dosage, form, appearance, instructions, purpose, times, days_of_week, start_date, end_date, pills_left, pills_per_dose, refill_threshold, color, notes, active, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  const result = insert.run(
    req.cid,
    med.name,
    med.dosage || null,
    med.form || 'tablet',
    med.appearance || null,
    med.instructions || 'anytime',
    med.purpose || null,
    JSON.stringify(med.times || []),
    JSON.stringify(med.days_of_week || [0,1,2,3,4,5,6]),
    med.start_date || null,
    med.end_date || null,
    med.pills_left || null,
    med.pills_per_dose || 1,
    med.refill_threshold || 5,
    med.color || '#0F766E',
    med.notes || null,
    1,
    req.ctx.userId || null
  );
  const medicationId = result.lastInsertRowid;
  ensureLogs(req.cid, new Date().toISOString().split('T')[0]); // ensure today logs
  logActivity(req.cid, req.ctx.label, 'medication_added', JSON.stringify({ medicationId }));
  const medication = db.prepare('SELECT * FROM medications WHERE id = ?').get(medicationId);
  medication.times = parseJson(medication.times);
  medication.days_of_week = parseJson(medication.days_of_week);
  res.status(201).json({ medication, warnings, disclaimer: DISCLAIMER });
});

/** PATCH /:mid – update medication */
router.patch('/:mid', requireCircle('edit'), (req, res) => {
  const mid = Number(req.params.mid);
  const updates = req.body;
  const cols = [];
  const vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'times' || k === 'days_of_week') {
      cols.push(`${k} = ?`);
      vals.push(JSON.stringify(v));
    } else {
      cols.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (cols.length === 0) return res.status(400).json({ error: 'No fields to update' });
  const stmt = db.prepare(`UPDATE medications SET ${cols.join(', ')} WHERE id = ? AND circle_id = ?`);
  stmt.run(...vals, mid, req.cid);
  // if times or days_of_week changed, delete future pending logs and ensure logs
  if (updates.times || updates.days_of_week) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`DELETE FROM dose_logs WHERE medication_id = ? AND scheduled_date >= ? AND status = 'pending'`).run(mid, today);
    ensureLogs(req.cid, today);
  }
  logActivity(req.cid, req.ctx.label, 'medication_updated', JSON.stringify({ medicationId: mid }));
  const medication = db.prepare('SELECT * FROM medications WHERE id = ?').get(mid);
  medication.times = parseJson(medication.times);
  medication.days_of_week = parseJson(medication.days_of_week);
  res.json({ medication });
});

/** DELETE /:mid – soft delete */
router.delete('/:mid', requireCircle('edit'), (req, res) => {
  const mid = Number(req.params.mid);
  db.prepare('UPDATE medications SET active = 0 WHERE id = ? AND circle_id = ?').run(mid, req.cid);
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`DELETE FROM dose_logs WHERE medication_id = ? AND scheduled_date >= ? AND status = 'pending'`).run(mid, today);
  logActivity(req.cid, req.ctx.label, 'medication_removed', JSON.stringify({ medicationId: mid }));
  res.json({ ok: true });
});

/** GET /:mid/explain – placeholder */
router.get('/:mid/explain', requireCircle('read'), (req, res) => {
  // Not implemented; return fallback empty text
  res.json({ text: '', source: 'fallback' });
});

module.exports = router;
