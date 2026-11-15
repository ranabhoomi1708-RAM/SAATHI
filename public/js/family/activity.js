// public/js/family/activity.js
// Family Activity tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Activity tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, role, refresh}
 */
export async function renderActivity(el, ctx) {
  el.innerHTML = '';
  const { cid, role } = ctx;

  // Load activity log (limit 50)
  let activity = [];
  try {
    const res = await api.get(`/circles/${cid}/activity?limit=50`);
    activity = res.activity || [];
  } catch (e) {
    toast('Failed to load activity');
    console.error(e);
  }

  const activityList = h('div', activity.map(item =>
    h('div.activity-item', `${fmtDateTime(item.created_at)} – ${item.actor || ''}: ${item.action} ${item.detail || ''}`)
  ));

  // Outbox (if any pending emails)
  let outbox = [];
  try {
    const res = await api.get('/outbox'); // endpoint relative to circle context returns recent emails
    outbox = res.emails || [];
  } catch (e) {
    // ignore if endpoint not available
  }

  const outboxDiv = outbox.length ? h('div', [
    h('h3', t('Outbox')),
    ...outbox.map(mail =>
      h('div.meds-card', [
        h('p', `${mail.to_email}`),
        h('p', mail.subject),
        h('p', mail.kind || '')
      ])
    )
  ]) : null;

  // Demo tools (admin only)
  const demoDiv = role === 'admin' ? h('div', [
    h('h3', t('Demo Tools')),
    h('button.btn.btn-primary', {
      onclick: async () => {
        try {
          const res = await api.post('/demo/tick', { offset_minutes: 35 });
          modal({ title: t('Demo Result'), body: h('pre', JSON.stringify(res, null, 2)) });
        } catch (e) { toast('Demo failed'); }
      }
    }, '+35 min'),
    h('button.btn.btn-primary', {
      onclick: async () => {
        try {
          const res = await api.post('/demo/tick', { offset_minutes: 65 });
          modal({ title: t('Demo Result'), body: h('pre', JSON.stringify(res, null, 2)) });
        } catch (e) { toast('Demo failed'); }
      }
    }, '+65 min')
  ]) : null;

  el.appendChild(activityList);
  if (outboxDiv) el.appendChild(outboxDiv);
  if (demoDiv) el.appendChild(demoDiv);
}
