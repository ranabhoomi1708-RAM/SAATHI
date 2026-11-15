// scheduler.js – background notification scheduler per contract

const db = require('../db');
const cron = require('node-cron');
const { localParts, toMin, localToEpoch } = require('./time');
const { ensureLogs } = require('./doselogic');
const notify = require('./notify');
const { logActivity } = require('./activity');

function once(key) {
  try {
    db.prepare('INSERT INTO notification_log(key) VALUES(?)').run(key);
    return true;
  } catch (e) {
    return false;
  }
}

async function tick(now = new Date()) {
  const actions = [];
  try {
    const lp = localParts(now);
    // mark past pending as missed (date before today)
    db.prepare("UPDATE dose_logs SET status='missed' WHERE status='pending' AND scheduled_date < ?").run(lp.date);
    const circles = db.prepare('SELECT id, elder_name FROM circles').all();
    for (const c of circles) {
      ensureLogs(c.id, lp.date);
      const pend = db.prepare(`SELECT d.*, m.name AS med_name FROM dose_logs d JOIN medications m ON d.medication_id = m.id WHERE d.circle_id = ? AND d.scheduled_date = ? AND d.status = 'pending' AND m.active = 1`).all(c.id, lp.date);
      for (const log of pend) {
        const sched = toMin(log.scheduled_time);
        const snoozed = log.snoozed_until ? toMin(log.snoozed_until) : 0;
        const late = lp.minutes - Math.max(sched, snoozed);
        if (late >= 0 && once('due:' + log.id)) {
          await notify.notifyDue(log.id);
          actions.push(`Due reminder: ${log.med_name} ${log.scheduled_time}`);
        }
        if (late >= 30 && once('nudge:' + log.id)) {
          await notify.notifyNudge(log.id);
          actions.push(`Gentle nudge: ${log.med_name} ${log.scheduled_time}`);
        }
        if (late >= 60 && once('missed:' + log.id)) {
          db.prepare("UPDATE dose_logs SET status='missed' WHERE id=? AND status='pending'").run(log.id);
          logActivity(c.id, 'Saathi', 'dose_missed', `${log.med_name} ${log.scheduled_time}`);
          await notify.notifyMissed(log.id);
          actions.push(`MISSED → caregivers emailed: ${log.med_name} ${log.scheduled_time}`);
        }
      }
      const missedToday = db.prepare("SELECT COUNT(*) n FROM dose_logs WHERE circle_id=? AND scheduled_date=? AND status='missed'").get(c.id, lp.date).n;
      if (missedToday >= 2 && once(`risk:${c.id}:${lp.date}`)) {
        await notify.notifyRisk(c.id, lp.date);
        actions.push('Risk alert: 2+ missed doses today');
      }
      const appts = db.prepare("SELECT id, datetime FROM appointments WHERE circle_id=? AND status='upcoming'").all(c.id);
      for (const a of appts) {
        const hrs = (localToEpoch(a.datetime) - now.getTime()) / 3600000;
        if (hrs > 0 && hrs <= 24 && once('appt24:' + a.id)) {
          await notify.notifyAppointment(a.id, '24h');
          actions.push('Appointment reminder (24h): ' + a.id);
        }
        if (hrs > 0 && hrs <= 2 && once('appt2:' + a.id)) {
          await notify.notifyAppointment(a.id, '2h');
          actions.push('Appointment reminder (2h): ' + a.id);
        }
      }
    }
  } catch (e) {
    console.error('tick failed', e);
    actions.push('Error: ' + e.message);
  }
  return actions;
}

function start() {
  cron.schedule('* * * * *', () => {
    tick().catch(err => console.error(err));
  });
  console.log('Scheduler started (every minute)');
}

module.exports = { start, tick };
