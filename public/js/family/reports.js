// public/js/family/reports.js
// Family Reports tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Reports tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, role, refresh}
 */
export async function renderReports(el, ctx) {
  el.innerHTML = '';
  const { cid } = ctx;

  // Load weekly report and insights
  let weekly = null;
  let insights = null;
  try {
    const [wRes, iRes] = await Promise.all([
      api.get(`/circles/${cid}/report/weekly`),
      api.get(`/circles/${cid}/insights`)
    ]);
    weekly = wRes;
    insights = iRes;
  } catch (e) {
    toast('Failed to load reports');
    console.error(e);
    return;
  }

  // Weekly summary card
  const weeklyCard = h('div.overview-card', [
    h('h3', t('Weekly Summary')),
    h('p', weekly.narrative || t('No narrative')),
    h('p', `${t('Adherence')}: ${weekly.stats?.adherence_pct ?? 'N/A'}%`),
    h('button.btn.btn-primary', {
      onclick: () => {
        // print view – open printable route (handled elsewhere)
        window.print();
      }
    }, t('Print'))
  ]);

  // Missed‑by‑slot mini‑bars
  const slotBars = (insights && insights.missed_by_slot) ? h('div.overview-card', [
    h('h3', t('Missed By Slot')),
    ...Object.entries(insights.missed_by_slot).map(([slot, count]) =>
      h('div', [
        h('span', `${slot}: `),
        h('div.report-bar', { style: `width:${Math.min(count * 10, 100)}%` }, `${count}`)
      ])
    )
  ]) : null;

  // History chart – simple bar list from doses/history
  let history = [];
  try {
    const res = await api.get(`/circles/${cid}/doses/history?days=14`);
    history = res.days || [];
  } catch (e) {
    // ignore
  }
  const historyChart = h('div.overview-card', [
    h('h3', t('Dose History (14 days)')),
    ...history.map(d =>
      h('div', [
        h('span', `${fmtDate(d.date)}: `),
        h('div.report-bar', { style: `width:${d.total * 5}%` }, `${d.total}`)
      ])
    )
  ]);

  // Mood trend strip
  const moodStrip = h('div.overview-card', [
    h('h3', t('Mood Trend')),
    h('div', (insights && insights.mood && insights.mood.last) ? insights.mood.last.map(m =>
      h('span.mood-emoji', MOODS[m.mood])
    ) : [h('p', t('No mood data'))])
  ]);

  el.appendChild(weeklyCard);
  if (slotBars) el.appendChild(slotBars);
  el.appendChild(historyChart);
  el.appendChild(moodStrip);
}
