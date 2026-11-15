// public/js/family/overview.js
// Family Overview tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, MOODS, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Overview tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, circle, role, me, refresh}
 */
export async function renderOverview(el, ctx) {
  el.innerHTML = '';
  const { cid } = ctx;

  // Helper to load data
  async function loadData() {
    try {
      const [{ doses }, { insights }, { moods }] = await Promise.all([
        api.get(`/circles/${cid}/doses/today`),
        api.get(`/circles/${cid}/insights`),
        api.get(`/circles/${cid}/mood`),
      ]);
      return { doses, insights, moods };
    } catch (e) {
      toast('Failed to load overview data');
      console.error(e);
      return {};
    }
  }

  // Render once
  async function render() {
    const data = await loadData();
    const { doses = { doses: [] }, insights = {}, moods = { moods: [] } } = data;
    const todayDoses = doses.doses || [];

    // Status card placeholder
    const statusCard = h('div.overview-card', [
      h('h3', t('Today Summary')),
      h('p', `Total: ${doses.summary?.total || 0}`),
      h('p', `Taken: ${doses.summary?.taken || 0}`),
      h('p', `Pending: ${doses.summary?.pending || 0}`),
      h('p', `Missed: ${doses.summary?.missed || 0}`),
    ]);

    // Adherence ring placeholder (simple text)
    const ring = h('div.overview-card', [
      h('h3', t('Adherence')),
      h('p', `${insights.adherence_7d || 'N/A'}%`)
    ]);

    // Today doses list
    const doseList = h('div.overview-card', [
      h('h3', t('Today Doses')),
      ...todayDoses.map(d =>
        h('div.dose-row', [
          h('span', `${fmtTime(d.time)} – ${d.name}`),
          ctx.role !== 'viewer' && h('button.btn.btn-primary', {
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/doses/${d.log_id}/take`);
                await ctx.refresh();
              } catch (e) { toast('Error taking dose'); }
            }
          }, t('Take')),
          ctx.role !== 'viewer' && h('button.btn.btn-danger', {
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/doses/${d.log_id}/skip`);
                await ctx.refresh();
              } catch (e) { toast('Error skipping dose'); }
            }
          }, t('Skip'))
        ])
      )
    ]);

    // Mood strip (emoji per mood)
    const moodStrip = h('div.overview-card', [
      h('h3', t('Mood')),
      h('div', moods.moods.map(m => h('span', { className: 'mood-emoji' }, MOODS[m.mood])) )
    ]);

    // Low stock placeholder (use insights.low_stock if present)
    const lowStock = h('div.overview-card', [
      h('h3', t('Low Stock')),
      h('ul', (insights.low_stock || []).map(it => h('li', `${it.name} (${it.pills_left} left)`)))
    ]);

    // Upcoming visits placeholder (use insights.upcoming_appointments if present)
    const upcoming = h('div.overview-card', [
      h('h3', t('Upcoming Visits')),
      h('ul', (insights.upcoming_appointments || []).map(v => h('li', `${v.doctor} – ${fmtDateTime(v.datetime)}`)))
    ]);

    el.appendChild(statusCard);
    el.appendChild(ring);
    el.appendChild(doseList);
    el.appendChild(moodStrip);
    el.appendChild(lowStock);
    el.appendChild(upcoming);
  }

  // Initial render
  await render();

  // Refresh every 30 seconds
  const interval = setInterval(render, 30000);
  onLeave(() => clearInterval(interval));
}
