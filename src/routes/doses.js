// doses.js – dose routes implementation per contract
'use strict';
const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { ensureLogs, formatDose, computeStats, DOSE_SELECT } = require('../lib/doselogic');
const { logActivity } = require('../lib/activity');
const { notifyLowStock } = require('../lib/notify');
const { localParts, dateRange } = require('../lib/time');

const router = express.Router({ mergeParams: true });

/** GET /today – list today doses */
router.get('/today', requireCircle('read'), (req, res) => {
  const today = localParts().date;
  ensureLogs(req.cid, today);
  const nowParts = localParts();
  const rows = db.prepare(DOSE_SELECT).all(req.cid, today);
  const doses = rows.map(r => formatDose(r, nowParts));
  const pending = doses.filter(d => d.status === 'pending');
  const next = pending.length ? pending[0] : null;
  const summary = {
    total: doses.length,
    taken: doses.filter(d => d.status === 'taken').length,
    pending: pending.length,
    missed: doses.filter(d => d.status === 'missed').length,
    skipped: doses.filter(d => d.status === 'skipped').length
  };
  const sosActive = !!db.prepare('SELECT 1 FROM sos_events WHERE circle_id = ? AND resolved_at IS NULL').get(req.cid);
  res.json({ date: today, now: nowParts.time, doses, next, summary, sos_active: !!sosActive });
});

function handleTake(req, res) {
  const logId = Number(req.params.logId);
  const nowParts = localParts();
  const dose = db.prepare('SELECT * FROM dose_logs WHERE id = ? AND circle_id = ?').get(logId, req.cid);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });
  if (dose.status === 'taken') return res.status(409).json({ error: 'Already taken', already_taken_at: dose.taken_at });

  // double-dose guard
  const recent = db.prepare(`
    SELECT dl.* FROM dose_logs dl 
    WHERE dl.circle_id = ? AND dl.status = 'taken' AND dl.medication_id = ? 
      AND datetime(dl.taken_at) >= datetime('now', '-60 minutes')
  `).get(req.cid, dose.medication_id);

  if (recent && req.body.confirm !== true) {
    return res.status(409).json({ error: 'This medicine was taken less than an hour ago', needs_confirm: true });
  }

  const nowIso = new Date().toISOString();
  db.prepare('UPDATE dose_logs SET status = ?, taken_at = ?, logged_by = ? WHERE id = ?').run('taken', nowIso, req.ctx.label, logId);

  // decrement pills_left
  const med = db.prepare('SELECT pills_left, pills_per_dose FROM medications WHERE id = ?').get(dose.medication_id);
  if (med && typeof med.pills_left === 'number') {
    const newLeft = Math.max(0, med.pills_left - (med.pills_per_dose || 1));
    db.prepare('UPDATE medications SET pills_left = ? WHERE id = ?').run(newLeft, dose.medication_id);
    try { notifyLowStock(dose.medication_id); } catch (_) {}
  }

  logActivity(req.cid, req.ctx.label, 'dose_taken', JSON.stringify({ doseId: logId }));
  const rows = db.prepare(DOSE_SELECT).all(req.cid, dose.scheduled_date);
  const updated = rows.find(r => r.log_id === logId) || rows[0];
  const formatted = formatDose(updated, nowParts);
  res.json({ dose: formatted });
}

router.post('/doses/:logId/take', requireCircle('log'), handleTake);
router.post('/:logId/take', requireCircle('log'), handleTake);

function handleSkip(req, res) {
  const logId = Number(req.params.logId);
  const dose = db.prepare('SELECT * FROM dose_logs WHERE id = ? AND circle_id = ?').get(logId, req.cid);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });

  db.prepare('UPDATE dose_logs SET status = ?, logged_by = ? WHERE id = ? AND circle_id = ?')
    .run('skipped', req.ctx.label, logId, req.cid);

  logActivity(req.cid, req.ctx.label, 'dose_skipped', JSON.stringify({ doseId: logId }));
  const nowParts = localParts();
  const rows = db.prepare(DOSE_SELECT).all(req.cid, dose.scheduled_date);
  const updated = rows.find(r => r.log_id === logId) || rows[0];
  const formatted = formatDose(updated, nowParts);
  res.json({ dose: formatted });
}

router.post('/doses/:logId/skip', requireCircle('log'), handleSkip);
router.post('/:logId/skip', requireCircle('log'), handleSkip);

function handleSnooze(req, res) {
  const minutes = Number(req.body.minutes);
  if (isNaN(minutes) || minutes < 5 || minutes > 120) return res.status(400).json({ error: 'Invalid minutes' });

  const logId = Number(req.params.logId);
  const dose = db.prepare('SELECT * FROM dose_logs WHERE id = ? AND circle_id = ?').get(logId, req.cid);
  if (!dose) return res.status(404).json({ error: 'Dose not found' });

  const nowParts = localParts();
  const currentTotalMin = nowParts.minutes + minutes;
  const h = Math.min(23, Math.floor(currentTotalMin / 60));
  const m = Math.min(59, currentTotalMin % 60);
  const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  db.prepare('UPDATE dose_logs SET snoozed_until = ? WHERE id = ? AND circle_id = ?').run(hhmm, logId, req.cid);
  logActivity(req.cid, req.ctx.label, 'dose_snoozed', JSON.stringify({ doseId: logId, minutes }));

  const rows = db.prepare(DOSE_SELECT).all(req.cid, dose.scheduled_date);
  const updated = rows.find(r => r.log_id === logId) || rows[0];
  const formatted = formatDose(updated, nowParts);
  res.json({ dose: formatted });
}

router.post('/doses/:logId/snooze', requireCircle('log'), handleSnooze);
router.post('/:logId/snooze', requireCircle('log'), handleSnooze);

function handleHistory(req, res) {
  const days = Math.min(60, Number(req.query.days) || 14);
  const stats = computeStats(req.cid, days);
  const endDate = localParts().date;
  const range = dateRange(endDate, days);

  const daysList = range.map(d => {
    const rows = db.prepare('SELECT status FROM dose_logs WHERE circle_id = ? AND scheduled_date = ?').all(req.cid, d);
    return {
      date: d,
      total: rows.length,
      taken: rows.filter(r => r.status === 'taken').length,
      missed: rows.filter(r => r.status === 'missed').length,
      skipped: rows.filter(r => r.status === 'skipped').length,
      pending: rows.filter(r => r.status === 'pending').length
    };
  });

  res.json({ days: daysList, adherence_pct: stats.adherence_pct });
}

router.get('/doses/history', requireCircle('read'), handleHistory);
router.get('/history', requireCircle('read'), handleHistory);

function handleLog(req, res) {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'date required' });
  const rows = db.prepare(DOSE_SELECT).all(req.cid, date);
  const nowParts = localParts();
  const doses = rows.map(r => formatDose(r, nowParts));
  res.json({ doses });
}

router.get('/doses/log', requireCircle('read'), handleLog);
router.get('/log', requireCircle('read'), handleLog);

module.exports = router;
