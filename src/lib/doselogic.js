// doselogic.js – core dose scheduling utilities

const db = require('../db');
const { localParts, toMin, dateRange, addDays, pad } = require('../lib/time');

/**
 * SELECT query used by dose routes. It joins dose_logs with medication fields needed.
 */
const DOSE_SELECT = `
  SELECT 
    dl.id AS log_id,
    dl.medication_id,
    m.name,
    m.dosage,
    m.form,
    m.appearance,
    m.instructions,
    m.purpose,
    m.color,
    dl.scheduled_time AS time,
    dl.status,
    dl.taken_at,
    dl.logged_by,
    dl.snoozed_until,
    m.pills_left,
    m.pills_per_dose
  FROM dose_logs dl
  JOIN medications m ON dl.medication_id = m.id
  WHERE dl.circle_id = ?
    AND dl.scheduled_date = ?
  ORDER BY dl.scheduled_time ASC;
`;

/**
 * Ensure dose logs exist for a given circle and date.
 * For each active medication that should have a dose on that date, insert a pending log if missing.
 */
function ensureLogs(circleId, dateStr) {
  const dayOfWeek = new Date(dateStr).getDay(); // 0=Sun
  const meds = db.prepare(`SELECT id, times, days_of_week FROM medications WHERE circle_id = ? AND active = 1`).all(circleId);
  const insert = db.prepare(`INSERT OR IGNORE INTO dose_logs (circle_id, medication_id, scheduled_date, scheduled_time) VALUES (?,?,?,?)`);
  for (const med of meds) {
    // parse JSON arrays stored as text
    let times;
    try { times = JSON.parse(med.times); } catch { continue; }
    let days;
    try { days = JSON.parse(med.days_of_week); } catch { days = []; }
    // check if this date is within start/end and day of week allowed
    // For simplicity, ignore start/end date constraints (assume applicable)
    if (!days.includes(dayOfWeek)) continue;
    for (const t of times) {
      insert.run(circleId, med.id, dateStr, t);
    }
  }
}

/**
 * Convert a dose log row into the API dose object, adding is_due and minutes_overdue.
 */
function formatDose(row, nowParts) {
  const scheduledMin = toMin(row.time);
  const nowMin = nowParts.minutes;
  const isDue = nowMin >= scheduledMin;
  const minutesOverdue = isDue ? nowMin - scheduledMin : 0;
  return {
    log_id: row.log_id,
    medication_id: row.medication_id,
    name: row.name,
    dosage: row.dosage,
    form: row.form,
    appearance: row.appearance,
    instructions: row.instructions,
    purpose: row.purpose,
    color: row.color,
    time: row.time,
    status: row.status,
    taken_at: row.taken_at,
    logged_by: row.logged_by,
    snoozed_until: row.snoozed_until,
    is_due: isDue,
    minutes_overdue: minutesOverdue,
    pills_left: row.pills_left,
    pills_per_dose: row.pills_per_dose
  };
}

/**
 * Compute adherence statistics over a number of past days.
 */
function computeStats(circleId, days) {
  const endDate = localParts().date;
  const range = dateRange(endDate, days);
  const placeholders = range.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT dl.status, m.name, dl.scheduled_time
    FROM dose_logs dl
    JOIN medications m ON dl.medication_id = m.id
    WHERE dl.circle_id = ? AND dl.scheduled_date IN (${placeholders})
  `).all(circleId, ...range);

  let taken = 0, missed = 0, skipped = 0;
  const missedByMed = {};
  const missedBySlot = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  for (const r of rows) {
    if (r.status === 'taken') taken++;
    else if (r.status === 'missed') {
      missed++;
      missedByMed[r.name] = (missedByMed[r.name] || 0) + 1;
      const hour = parseInt(r.scheduled_time.split(':')[0], 10);
      if (hour >= 5 && hour <= 11) missedBySlot.morning++;
      else if (hour >= 12 && hour <= 16) missedBySlot.afternoon++;
      else if (hour >= 17 && hour <= 20) missedBySlot.evening++;
      else missedBySlot.night++;
    } else if (r.status === 'skipped') skipped++;
  }

  const adherence_pct = (taken + missed + skipped) > 0 ? Math.round(100 * taken / (taken + missed + skipped)) : null;
  const missed_by_med = Object.entries(missedByMed).map(([name, count]) => ({ name, count }));
  return { taken, missed, skipped, adherence_pct, missed_by_med, missed_by_slot: missedBySlot };
}

module.exports = { DOSE_SELECT, ensureLogs, formatDose, computeStats };
