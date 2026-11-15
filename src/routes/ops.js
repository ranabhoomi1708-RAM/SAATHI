// ops.js – ops routes per contract (emergency card, SOS, outbox, demo tick)

const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { notifySOS, notifyAppointment, notifyLowStock } = require('../lib/notify');
const { start: startScheduler, tick: schedulerTick } = require('../lib/scheduler');

const router = express.Router({ mergeParams: true });

/** Helper to parse JSON safely */
function parseJson(col) {
  try { return JSON.parse(col); } catch { return []; }
}

/** GET /emergency-card */
router.get('/emergency-card', requireCircle('read'), (req, res) => {
  const cid = req.cid;
  const circle = db.prepare('SELECT elder_name, elder_age, blood_group, conditions, allergies, doctor_name, doctor_phone, emergency_notes FROM circles WHERE id = ?').get(cid);
  const meds = db.prepare(`SELECT name, dosage, times, instructions FROM medications WHERE circle_id = ? AND active = 1`).all(cid).map(m => ({
    name: m.name,
    dosage: m.dosage,
    times: (() => { try { return JSON.parse(m.times); } catch { return []; } })(),
    instructions: m.instructions
  }));
  const contacts = db.prepare(`SELECT u.name, m.relation, u.phone FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND m.status = 'active'`).all(cid);
  res.json({ elder: circle, medications: meds, contacts });
});

/** POST /sos */
router.post('/sos', requireCircle('log'), async (req, res) => {
  const cid = req.cid;
  // check for unresolved SOS in last 10 minutes
  const recent = db.prepare(`SELECT id, created_at FROM sos_events WHERE circle_id = ? AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 1`).get(cid);
  const now = new Date();
  let sosId;
  let notified = 0;
  if (recent) {
    const created = new Date(recent.created_at);
    const diffMin = (now - created) / 60000;
    if (diffMin <= 10) {
      sosId = recent.id;
    }
  }
  if (!sosId) {
    const ins = db.prepare(`INSERT INTO sos_events (circle_id, triggered_by) VALUES (?,?)`).run(cid, req.ctx.label);
    sosId = ins.lastInsertRowid;
    notified = await notifySOS(sosId);
    logActivity(cid, req.ctx.label, 'sos', 'SOS pressed');
  }
  const sosRow = db.prepare('SELECT id, created_at FROM sos_events WHERE id = ?').get(sosId);
  res.status(201).json({ sos: { id: sosId, created_at: sosRow ? sosRow.created_at : new Date().toISOString() }, notified });
});

/** GET /sos/active */
router.get('/sos/active', requireCircle('read'), (req, res) => {
  const row = db.prepare(`SELECT * FROM sos_events WHERE circle_id = ? AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 1`).get(req.cid);
  if (!row) return res.json({ sos: null });
  res.json({ sos: row });
});

/** POST /sos/:id/resolve */
router.post('/sos/:id/resolve', requireCircle('edit'), (req, res) => {
  const sid = Number(req.params.id);
  const nowStr = new Date().toISOString();
  db.prepare(`UPDATE sos_events SET resolved_at = ?, resolved_by = ? WHERE id = ? AND circle_id = ?`).run(nowStr, req.ctx.label, sid, req.cid);
  logActivity(req.cid, req.ctx.label, 'sos_resolved', `SOS ${sid} resolved`);
  res.json({ ok: true });
});

/** GET /outbox */
router.get('/outbox', requireCircle('edit'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM outbox WHERE circle_id = ? ORDER BY created_at DESC LIMIT 30`).all(req.cid);
  res.json({ emails: rows });
});

/** POST /demo/tick */
router.post('/demo/tick', requireCircle('edit'), async (req, res) => {
  const offset = Number(req.body.offset_minutes);
  if (isNaN(offset) || offset < 1 || offset > 180) {
    return res.status(400).json({ error: 'Invalid offset' });
  }
  const future = new Date(Date.now() + offset * 60000);
  const actions = await schedulerTick(future);
  logActivity(req.cid, req.ctx.label, 'demo_tick', `Simulated +${offset} minutes`);
  res.json({ ok: true, actions });
});

module.exports = router;
