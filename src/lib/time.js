const OFFSET = parseInt(process.env.APP_TZ_OFFSET_MIN || '330', 10);
const pad = n => String(n).padStart(2, '0');
function localParts(d = new Date()) {
  const s = new Date(d.getTime() + OFFSET * 60000);
  const date = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
  const time = `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
  return { date, time, minutes: s.getUTCHours() * 60 + s.getUTCMinutes(), dow: s.getUTCDay() };
}
function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function localToEpoch(dt) {
  const [d, t] = dt.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = (t || '00:00').split(':').map(Number);
  return Date.UTC(y, mo - 1, da, h, mi) - OFFSET * 60000;
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function dateRange(endDate, days) { const out = []; for (let i = days - 1; i >= 0; i--) out.push(addDays(endDate, -i)); return out; }
function dowOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
module.exports = { OFFSET, localParts, toMin, localToEpoch, addDays, dateRange, dowOf, pad };