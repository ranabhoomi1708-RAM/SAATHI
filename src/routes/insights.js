// insights.js – insights, activity, weekly report routes per contract

const express = require('express');
const db = require('../db');
const { requireCircle } = require('../lib/auth');
const { computeStats } = require('../lib/doselogic');
const { localParts, addDays, dateRange } = require('../lib/time');
const { logActivity } = require('../lib/activity');

const router = express.Router({ mergeParams: true });

/** Helper to parse JSON columns safely */
function parseJson(col) {
  try { return JSON.parse(col); } catch { return []; }
}

/** GET /insights */
router.get('/insights', requireCircle('read'), (req, res) => {
  const cid = req.cid;
  // adherence and missed_by_slot from last 7 days
  const stats = computeStats(cid, 7);
  // streak_days: consecutive past days (ending yesterday) with zero missed and at least one taken
  const today = localParts().date;
  let streak = 0;
  for (let i = 1; i <= 30; i++) {
    const day = addDays(today, -i);
    const missed = db.prepare("SELECT COUNT(*) n FROM dose_logs WHERE circle_id=? AND scheduled_date=? AND status='missed'").get(cid, day).n;
    const taken = db.prepare("SELECT COUNT(*) n FROM dose_logs WHERE circle_id=? AND scheduled_date=? AND status='taken'").get(cid, day).n;
    if (missed === 0 && taken > 0) {
      streak++;
    } else {
      break;
    }
  }

  // mood avg 7d and last moods
  const moodRows = db.prepare(`SELECT * FROM mood_checkins WHERE circle_id = ? ORDER BY date DESC LIMIT 7`).all(cid);
  const moodVals = moodRows.map(r => r.mood);
  const mood_avg_7d = moodVals.length ? Math.round(moodVals.reduce((a,b)=>a+b,0)/moodVals.length) : null;
  const mood_last = moodRows.map(r => ({date: r.date, mood: r.mood}));

  // low stock meds
  const low_stock = db.prepare(`SELECT name, pills_left FROM medications WHERE circle_id=? AND active=1 AND pills_left <= refill_threshold`).all(cid);

  // flags
  const flags = [];
  // SOS active flag
  const sos = db.prepare(`SELECT * FROM sos_events WHERE circle_id=? AND resolved_at IS NULL`).get(cid);
  if (sos) flags.push({level:'urgent', text:'SOS pressed — check immediately'});
  // missed today >=2 flag
  const missedToday = db.prepare("SELECT COUNT(*) n FROM dose_logs WHERE circle_id=? AND scheduled_date=? AND status='missed'").get(cid, today).n;
  if (missedToday >= 2) flags.push({level:'warning', text:'>2 missed doses today'});
  // adherence <80
  if (stats.adherence_pct !== null && stats.adherence_pct < 80) flags.push({level:'warning', text:'Adherence below 80%'});
  // slot miss >3 in 7 days
  for (const [slot, count] of Object.entries(stats.missed_by_slot)) {
    if (count >= 3) flags.push({level:'warning', text:`${slot.charAt(0).toUpperCase()+slot.slice(1)} doses are missed most often (${count} in 7 days)`});
  }
  // low stock flag already covered by low_stock length
  if (low_stock.length) flags.push({level:'warning', text:'Some medications running low'});
  // mood low flag
  const recentMoods = moodRows.slice(0,3);
  if (recentMoods.filter(r=>r.mood<=2).length >= 2) flags.push({level:'warning', text:'Recent mood low'});
  // upcoming appointment without accompaniment within 24h
  const upcomingAppt = db.prepare(`SELECT * FROM appointments WHERE circle_id=? AND status='upcoming' AND datetime(datetime) <= datetime('now', '+24 hours')`).get(cid);
  if (upcomingAppt && !upcomingAppt.accompanied_by) flags.push({level:'warning', text:'Upcoming appointment without companion'});

  const overall = flags.some(f=>f.level==='urgent') ? 'urgent' : (flags.some(f=>f.level==='warning') ? 'attention' : 'good');

  res.json({
    adherence_7d: stats.adherence_pct,
    streak_days: streak,
    missed_by_slot: stats.missed_by_slot,
    mood: { avg_7d: mood_avg_7d, last: mood_last },
    low_stock,
    flags,
    overall
  });
});

/** GET /activity */
router.get('/activity', requireCircle('read'), (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit,10) || 50);
  const rows = db.prepare(`SELECT * FROM activity_log WHERE circle_id = ? ORDER BY created_at DESC LIMIT ?`).all(req.cid, limit);
  res.json({ activity: rows });
});

/** GET /report/weekly */
router.get('/report/weekly', requireCircle('read'), async (req, res) => {
  const cid = req.cid;
  const today = localParts().date;
  const from = addDays(today, -6);
  const stats = computeStats(cid, 7);
  const moodRows = db.prepare(`SELECT * FROM mood_checkins WHERE circle_id = ? ORDER BY date DESC LIMIT 7`).all(cid);
  const moodVals = moodRows.map(r=>r.mood);
  const mood_avg = moodVals.length ? Math.round(moodVals.reduce((a,b)=>a+b,0)/moodVals.length) : null;
  const mostMissedSlot = Object.entries(stats.missed_by_slot).find(([,c])=>c===Math.max(...Object.values(stats.missed_by_slot)));
  const slotName = mostMissedSlot ? mostMissedSlot[0] : null;
  const mostMissedMeds = stats.missed_by_med.slice(0,3).map(m=>m.name);

  const circle = db.prepare('SELECT elder_name, elder_age FROM circles WHERE id=?').get(cid);
  const prompt = `Write a warm, plain-language weekly summary (max 110 words) for the family of ${circle.elder_name}, aged ${circle.elder_age || ''}. Facts: adherence ${stats.adherence_pct || ''}%, taken ${stats.taken}, missed ${stats.missed}, skipped ${stats.skipped}, most-missed time of day: ${slotName||'none'}, most-missed medicines: ${mostMissedMeds.join(', ')||'none'}, average mood 1-5: ${mood_avg||'unknown'}. Be kind, specific and practical. Suggest at most two gentle actions. Do NOT give medical advice or dose changes. Plain text only.`;
  const { generateText, enabled } = require('../lib/gemini');
  let narrative = '';
  let source = 'fallback';
  if (enabled()) {
    const txt = await generateText(prompt);
    if (txt) { narrative = txt; source = 'gemini'; }
  }
  if (!narrative) {
    const slotSentence = slotName ? `Most missed doses happen in the ${slotName}. ` : '';
    const moodSentence = mood_avg ? `Average mood was ${mood_avg} out of 5. ` : '';
    narrative = `This week ${circle.elder_name} took ${stats.taken} doses, missed ${stats.missed} and skipped ${stats.skipped} (${stats.adherence_pct}% on track). ${slotSentence}${moodSentence}Small steps help: a quick call around the most-missed time can make a big difference.`;
    source = 'fallback';
  }
  res.json({
    period: { from, to: today },
    stats: { adherence_pct: stats.adherence_pct, taken: stats.taken, missed: stats.missed, skipped: stats.skipped, mood_avg },
    narrative,
    source
  });
});

module.exports = router;
