// public/js/family/medicines.js
// Family Medicines tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Medicines tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, role, refresh}
 */
export async function renderMedicines(el, ctx) {
  el.innerHTML = '';
  const { cid, role } = ctx;

  // Toolbar
  const toolbar = h('div.fam-tabs', [
    h('button.btn.btn-primary', {
      onclick: () => {
        modal({
          title: t('Add Medicine'),
          body: h('p', t('Form implementation omitted for brevity')),
          onOk: async () => {
            // placeholder: just refresh
            await ctx.refresh();
          }
        });
      }
    }, t('Add')),
    h('button.btn.btn-ghost', {
      onclick: async () => {
        // Scan prescription stub
        toast(t('Scan not implemented'));
      }
    }, t('Scan'))
  ]);

  // Load medicines
  let meds = [];
  try {
    const res = await api.get(`/circles/${cid}/medications`);
    meds = res.medications || [];
  } catch (e) {
    toast('Failed to load medicines');
    console.error(e);
  }

  const list = h('div', meds.map(m =>
    h('div.meds-card', [
      h('h4', m.name),
      h('p', `${m.dosage || ''} ${m.form}`),
      h('p', t('Instructions') + ': ' + (m.instructions || '')),
      role !== 'viewer' && h('div.actions', [
        h('button.btn.btn-primary', {
          onclick: async () => {
            // Edit stub
            toast(t('Edit not implemented'));
          }
        }, t('Edit')),
        h('button.btn.btn-danger', {
          onclick: async () => {
            const ok = await confirmDialog(t('Delete this medicine?'));
            if (ok) {
              try {
                await api.delete(`/circles/${cid}/medications/${m.id}`);
                await ctx.refresh();
              } catch (e) { toast('Delete failed'); }
            }
          }
        }, t('Delete'))
      ])
    ])
  ));

  el.appendChild(toolbar);
  el.appendChild(list);
}
