// notify.js – email notification helpers per contract

const db = require('../db');
const { sendMail } = require('./mail');
const { logActivity } = require('./activity');
const { localParts, toMin, dateRange } = require('../lib/time');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function firstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

function link(cid) {
  return `${APP_URL}/#/app/${cid}/overview`;
}

function wrap(html) {
  return `<div style="font-family:Arial,sans-serif;font-size:18px;line-height:1.5;max-width:560px;margin:auto;padding:16px">${html}</div>`;
}

// helper to queue email via sendMail, returns number of emails queued (0 on error)
async function queue(kind, to, subject, text, circleId = null) {
  try {
    const html = wrap(text.replace(/\n/g, '<br>'));
    await sendMail({ circleId, to, subject, text, html, kind });
    return 1;
  } catch (e) {
    console.error('notify error', e);
    return 0;
  }
}

// 1. notifyDue
async function notifyDue(logId) {
  try {
    const log = db.prepare(`SELECT dl.*, m.name, m.dosage, m.instructions, c.elder_name, c.elder_email FROM dose_logs dl JOIN medications m ON dl.medication_id = m.id JOIN circles c ON dl.circle_id = c.id WHERE dl.id = ?`).get(logId);
    if (!log) return 0;
    const elderFirst = firstName(log.elder_name);
    const time = log.scheduled_time;
    const instrMap = {
      with_food: 'with food',
      before_food: 'before food',
      after_food: 'after food',
      empty_stomach: 'on an empty stomach',
      bedtime: 'at bedtime',
      anytime: 'any time'
    };
    const instr = instrMap[log.instructions] || log.instructions;
    const bodyElder = `Namaste ${elderFirst},\n\nIt is ${time}. Time to take: ${log.name} ${log.dosage} (${instr}).\n\nPlease open Saathi and press the green button after you take it.\n\n— Saathi`;
    const bodyMember = `${elderFirst} has a medicine due now: ${log.name} ${log.dosage} at ${time}.`;
    let count = 0;
    if (log.elder_email) {
      count += await queue('due_elder', log.elder_email, 'Saathi: time for your medicine', bodyElder, log.circle_id);
    }
    const members = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND (m.notify_upcoming = 1 OR m.notify_missed = 1)`).all(log.circle_id);
    for (const mem of members) {
      if (mem.email) count += await queue('due_member', mem.email, 'Saathi: time for your medicine', bodyMember, log.circle_id);
    }
    return count;
  } catch (e) {
    console.error('notifyDue error', e);
    return 0;
  }
}

// 2. notifyNudge
async function notifyNudge(logId) {
  try {
    const log = db.prepare(`SELECT dl.*, m.name, m.dosage, c.elder_name, c.elder_email FROM dose_logs dl JOIN medications m ON dl.medication_id = m.id JOIN circles c ON dl.circle_id = c.id WHERE dl.id = ?`).get(logId);
    if (!log || !log.elder_email) return 0;
    const elderFirst = firstName(log.elder_name);
    const time = log.scheduled_time;
    const body = `Namaste ${elderFirst}, your ${time} medicine (${log.name}) is still waiting. If you already took it, please press 'I TOOK IT' in Saathi so your family does not worry. If not, please take it now.`;
    return await queue('nudge', log.elder_email, 'Saathi: a gentle reminder', body, log.circle_id);
  } catch (e) {
    console.error('notifyNudge error', e);
    return 0;
  }
}

// 3. notifyMissed
async function notifyMissed(logId) {
  try {
    const log = db.prepare(`SELECT dl.*, m.name, m.dosage, c.elder_name, c.elder_email, c.elder_age, c.doctor_name, c.doctor_phone FROM dose_logs dl JOIN medications m ON dl.medication_id = m.id JOIN circles c ON dl.circle_id = c.id WHERE dl.id = ?`).get(logId);
    if (!log) return 0;
    const elder = log.elder_name;
    const time = log.scheduled_time;
    const body = `${elder} has not confirmed ${log.name} ${log.dosage} scheduled at ${time}.\n\nWhat to do:\n1. Call ${firstName(elder)} first.\n2. Do NOT double the next dose.\n3. If unsure, ask their doctor${log.doctor_name ? ' (' + log.doctor_name + ', ' + (log.doctor_phone || '') + ')' : ''} or pharmacist.\n\nOpen the dashboard: ${link(log.circle_id)}`;
    const members = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND m.notify_missed = 1`).all(log.circle_id);
    let count = 0;
    for (const mem of members) {
      if (mem.email) count += await queue('missed', mem.email, `${elder} missed a dose — Saathi`, body, log.circle_id);
    }
    // activity log
    logActivity(log.circle_id, 'Saathi', 'missed_alert', `Emailed caregivers about ${log.name} ${time}`);
    return count;
  } catch (e) {
    console.error('notifyMissed error', e);
    return 0;
  }
}

// 4. notifyRisk
async function notifyRisk(circleId, date) {
  try {
    const circle = db.prepare('SELECT elder_name FROM circles WHERE id = ?').get(circleId);
    const missed = db.prepare(`SELECT scheduled_time, m.name FROM dose_logs dl JOIN medications m ON dl.medication_id = m.id WHERE dl.circle_id = ? AND dl.scheduled_date = ? AND dl.status = 'missed'`).all(circleId, date);
    if (!missed.length) return 0;
    const lines = missed.map(r => `- ${r.scheduled_time} ${r.name}`).join('\n');
    const body = `${lines}\n\nPlease check on ${firstName(circle.elder_name)} soon.\n${link(circleId)}`;
    const members = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND m.notify_missed = 1`).all(circleId);
    let count = 0;
    for (const mem of members) {
      if (mem.email) count += await queue('risk', mem.email, `${circle.elder_name} needs attention today — Saathi`, body, circleId);
    }
    return count;
  } catch (e) {
    console.error('notifyRisk error', e);
    return 0;
  }
}

// 5. notifyAppointment
async function notifyAppointment(apptId, kind) {
  try {
    const appt = db.prepare(`SELECT a.*, c.elder_name FROM appointments a JOIN circles c ON a.circle_id = c.id WHERE a.id = ?`).get(apptId);
    if (!appt) return 0;
    const elder = appt.elder_name;
    const elderFirst = firstName(elder);
    const dt = new Date(appt.datetime);
    const pretty = dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true });
    const subject = kind === '24h' ? 'Doctor visit tomorrow — Saathi' : 'Doctor visit in about 2 hours — Saathi';
    const body = `${elder} has a visit with ${appt.doctor}${appt.specialty ? ' (' + appt.specialty + ')' : ''} at ${pretty}${appt.location ? ' — ' + appt.location : ''}.\nPurpose: ${appt.purpose || '—'}\nWho is going: ${appt.accompanied_by || 'NOBODY YET — please open Saathi and tap “I’ll take them”'}\n${link(appt.circle_id)}`;
    const members = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND (m.notify_appointments = 1 OR m.notify_upcoming = 1)`).all(appt.circle_id);
    if (appt.elder_email) members.push({ email: appt.elder_email });
    let count = 0;
    for (const mem of members) {
      if (mem.email) count += await queue('appointment', mem.email, subject, body, appt.circle_id);
    }
    return count;
  } catch (e) {
    console.error('notifyAppointment error', e);
    return 0;
  }
}

// 6. notifyLowStock
// 6. notifyLowStock
async function notifyLowStock(medicationId) {
  try {
    const med = db.prepare(`SELECT m.*, c.elder_name, c.id as circle_id FROM medications m JOIN circles c ON m.circle_id = c.id WHERE m.id = ?`).get(medicationId);
    if (!med) return 0;
    const key = `low:${medicationId}:${localParts().date}`;
    try {
      db.prepare('INSERT INTO notification_log(key) VALUES(?)').run(key);
    } catch (e) {
      // duplicate key -> already sent today
      return 0;
    }
    // compute days left
    const times = JSON.parse(med.times);
    const pills_per_dose = med.pills_per_dose || 1;
    const days_left = Math.floor((med.pills_left || 0) / (pills_per_dose * times.length));
    const subject = 'A medicine is running low — Saathi';
    const body = `${med.name} for ${med.elder_name} has ${med.pills_left} tablets left (about ${days_left} days). Please arrange a refill.\n${link(med.circle_id)}`;
    const members = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ? AND m.notify_missed = 1`).all(med.circle_id);
    let count = 0;
    for (const mem of members) {
      if (mem.email) count += await queue('lowstock', mem.email, subject, body, med.circle_id);
    }
    return count;
  } catch (e) {
    console.error('notifyLowStock error', e);
    return 0;
  }
}

// 7. notifySOS
async function notifySOS(sosId) {
  try {
    const sos = db.prepare(`SELECT s.*, c.elder_name, c.elder_email, c.doctor_name, c.doctor_phone, c.id as circle_id FROM sos_events s JOIN circles c ON s.circle_id = c.id WHERE s.id = ?`).get(sosId);
    if (!sos) return 0;
    const elder = sos.elder_name;
    const time = new Date(sos.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true });
    const subject = `URGENT: ${elder} pressed the help button — Saathi`;
    const body = `${elder} pressed the help button at ${time}.\n\nCALL THEM NOW. If you cannot reach them, call a neighbour or emergency services.\nDoctor: ${sos.doctor_name || '—'} ${sos.doctor_phone || ''}\nEmergency card: ${APP_URL}/#/emergency/${sos.circle_id}\n${link(sos.circle_id)}`;
    const recipients = db.prepare(`SELECT u.email FROM members m JOIN users u ON m.user_id = u.id WHERE m.circle_id = ?`).all(sos.circle_id);
    let count = 0;
    for (const rec of recipients) {
      if (rec.email) count += await queue('sos', rec.email, subject, body, sos.circle_id);
    }
    return count;
  } catch (e) {
    console.error('notifySOS error', e);
    return 0;
  }
}

module.exports = { notifyDue, notifyNudge, notifyMissed, notifyRisk, notifyAppointment, notifyLowStock, notifySOS };
