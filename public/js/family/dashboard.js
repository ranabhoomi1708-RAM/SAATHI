// public/js/family/dashboard.js
// Family dashboard entry point
// Exports: renderFamily(el, {me, cid, tab})

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, speak, MOODS, onLeave } from '../ui.js';
import { t, getLang, setLang } from '../i18n.js';
import { renderOverview } from './overview.js';
import { renderMedicines } from './medicines.js';
import { renderAppointments } from './appointments.js';
import { renderCircleTab } from './circle.js';
import { renderActivity } from './activity.js';
import { renderReports } from './reports.js';

/**
 * Render the family dashboard.
 * @param {HTMLElement} el Container element.
 * @param {Object} opts Options containing me, cid, tab.
 */
export async function renderFamily(el, { me, cid, tab }) {
  // Clear container
  el.innerHTML = '';

  // Context helper
  const ctx = {
    cid,
    me,
    role: null,
    circle: null,
    // Refresh function to reload current tab
    refresh: async () => await renderFamily(el, { me, cid, tab })
  };

  // Load circle info
  try {
    const { circle } = await api.get(`/circles/${cid}`);
    ctx.circle = circle;
    ctx.role = circle.my_role || 'viewer';
  } catch (e) {
    toast('Failed to load circle info');
    console.error(e);
    return;
  }

  // Top bar
  const topBar = h('div.fam-top', [
    // Circle selector (simple dropdown)
    h('select.circle-select', {
      onchange: e => {
        const newCid = e.target.value;
        window.location.hash = `#/app/${newCid}/${tab}`;
      },
      value: cid
    }, ctx.me.circles.map(c =>
      h('option', { value: c.id, selected: c.id === cid }, `${c.elder_name} (${c.id})`)
    )),
    // Sign‑out button
    h('button.btn.btn-primary.signout-btn', {
      onclick: async () => {
        await api.post('/auth/logout');
        window.location.hash = '#/login';
      }
    }, t('Sign out'))
  ]);

  // Tabs navigation
  const tabs = ['overview', 'medicines', 'appointments', 'circle', 'activity', 'reports'];
  const tabsNav = h('div.fam-tabs', tabs.map(ti => {
    const active = ti === tab;
    return h('div.tab', {
      className: active ? 'active' : '',
      onclick: () => {
        window.location.hash = `#/app/${cid}/${ti}`;
      }
    }, ti.charAt(0).toUpperCase() + ti.slice(1));
  }));

  // Content container for tab body
  const body = h('div.tab-body');

  // Append components
  el.appendChild(topBar);
  el.appendChild(tabsNav);
  el.appendChild(body);

  // Render selected tab
  try {
    switch (tab) {
      case 'overview':
        await renderOverview(body, ctx);
        break;
      case 'medicines':
        await renderMedicines(body, ctx);
        break;
      case 'appointments':
        await renderAppointments(body, ctx);
        break;
      case 'circle':
        await renderCircleTab(body, ctx);
        break;
      case 'activity':
        await renderActivity(body, ctx);
        break;
      case 'reports':
        await renderReports(body, ctx);
        break;
      default:
        body.textContent = t('Unknown tab');
    }
  } catch (e) {
    toast('Failed to load tab');
    console.error(e);
  }
}
