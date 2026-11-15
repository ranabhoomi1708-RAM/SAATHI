// public/js/family/appointments.js
// Family Appointments tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Appointments tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, role, refresh}
 */
export async function renderAppointments(el, ctx) {
  el.innerHTML = '';
  const { cid, role } = ctx;

  // State for segment: upcoming or done
  let segment = 'upcoming'; // default

  const setSegment = newSeg => {
    segment = newSeg;
    renderList();
  };

  // Toolbar with Add button and segment toggle
  const toolbar = h('div.fam-tabs', [
    h('button.btn.btn-primary', {
      onclick: () => {
        modal({
          title: t('Add Visit'),
          body: h('p', t('Form implementation omitted for brevity')),
          onOk: async () => {
            await ctx.refresh();
          }
        });
      }
    }, t('Add Visit')),
    h('button.btn' + (segment === 'upcoming' ? '.btn-primary' : '.btn-ghost'), {
      onclick: () => setSegment('upcoming')
    }, t('Upcoming')),
    h('button.btn' + (segment === 'done' ? '.btn-primary' : '.btn-ghost'), {
      onclick: () => setSegment('done')
    }, t('Done'))
  ]);

  el.appendChild(toolbar);

  // Container for list
  const listContainer = h('div');
  el.appendChild(listContainer);

  const renderList = async () => {
    listContainer.innerHTML = '';
    let appointments = [];
    try {
      const res = await api.get(`/circles/${cid}/appointments?status=${segment}`);
      appointments = res.appointments || [];
    } catch (e) {
      toast('Failed to load appointments');
      console.error(e);
    }

    const cards = appointments.map(appt => {
      const actions = [];
      if (segment === 'upcoming' && role !== 'viewer') {
        actions.push(
          h('button.btn.btn-primary', {
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/appointments/${appt.id}/claim`);
                await ctx.refresh();
              } catch (e) { toast('Claim failed'); }
            }
          }, t('Claim')),
          h('button.btn.btn-ghost', {
            onclick: () => {
              // Open preparation modal (placeholder)
              modal({
                title: t('Prepare Visit'),
                body: h('p', t('Preparation details omitted')),
                onOk: async () => { /* no action */ }
              });
            }
          }, t('Prepare'))
        );
      }
      if (segment === 'done' && role !== 'viewer') {
        actions.push(
          h('button.btn.btn-primary', {
            onclick: () => {
              // Edit modal placeholder
              modal({
                title: t('Edit Visit'),
                body: h('p', t('Edit form omitted')),
                onOk: async () => { await ctx.refresh(); }
              });
            }
          }, t('Edit'))
        );
      }
      return h('div.appt-card', [
        h('h4', `${appt.doctor} – ${fmtDateTime(appt.datetime)}`),
        h('p', appt.purpose || ''),
        h('p.status', `${t('Status')}: ${appt.status}`),
        h('div.actions', actions)
      ]);
    });

    listContainer.appendChild(
      h('div', cards.length ? cards : [h('p', t('No appointments found'))])
    );
  };

  // Initial render
  await renderList();
}
