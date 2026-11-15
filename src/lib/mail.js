const nodemailer = require('nodemailer');
const db = require('../db');
let transporter = null;
function getTransport() {
  if (transporter !== null) return transporter || null;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else transporter = false;
  return transporter || null;
}
async function sendMail({ circleId, to, subject, text, html, kind = 'general' }) {
  if (!to) return { sent: false, reason: 'no recipient' };
  const info = db.prepare('INSERT INTO outbox(circle_id,to_email,subject,body_text,body_html,kind) VALUES(?,?,?,?,?,?)')
    .run(circleId || null, to, subject, text || '', html || null, kind);
  const tr = getTransport();
  if (!tr) { console.log(`[email:smtp-not-configured] to=${to} subject=${subject}`); return { sent: false, reason: 'smtp not configured' }; }
  try {
    await tr.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
    db.prepare('UPDATE outbox SET sent=1 WHERE id=?').run(info.lastInsertRowid);
    return { sent: true };
  } catch (e) {
    db.prepare('UPDATE outbox SET error=? WHERE id=?').run(String(e.message).slice(0, 300), info.lastInsertRowid);
    console.error('Mail failed:', e.message);
    return { sent: false, reason: e.message };
  }
}
const FLAGS = ['notify_missed', 'notify_upcoming', 'notify_appointments'];
function recipientsFor(circleId, flag = null) {
  let sql = `SELECT u.email, u.name, m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.circle_id=? AND m.status='active'`;
  if (flag && FLAGS.includes(flag)) sql += ` AND m.${flag}=1`;
  return db.prepare(sql).all(circleId);
}
module.exports = { sendMail, recipientsFor };