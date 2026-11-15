// public/js/family/printviews.js
// Print view helpers for Family dashboard

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Emergency Card for printing.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx {cid}
 */
export async function renderEmergencyCard(el, { cid }) {
  el.innerHTML = '';
  try {
    const res = await api.get(`/circles/${cid}/emergency-card`);
    const { elder, medications, contacts } = res;
    const card = h('div', [
      h('h2', t('Emergency Card')),
      h('p', `${elder.name}, ${elder.age || ''}`),
      h('p', t('Blood Group') + ': ' + (elder.blood_group || '')),
      h('p', t('Allergies') + ': ' + (elder.allergies || '')),
      h('h3', t('Medications')),
      h('ul', medications.map(m => h('li', `${m.name} ${m.dosage || ''} ${m.times.join(', ')}`))),
      h('h3', t('Contacts')),
      h('ul', contacts.map(c => h('li', `${c.name} (${c.relation}) - ${c.phone || ''}`)))
    ]);
    el.appendChild(card);
  } catch (e) {
    toast('Failed to load emergency card');
    console.error(e);
  }
}

/**
 * Render a printable Visit Summary.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx {cid, aid}
 */
export async function renderVisitSummary(el, { cid, aid }) {
  el.innerHTML = '';
  try {
    const res = await api.get(`/circles/${cid}/appointments/${aid}`);
    const appt = res.appointment || res; // fallback if API returns directly
    const card = h('div', [
      h('h2', t('Visit Summary')),
      h('p', `${t('Doctor')}: ${appt.doctor}`),
      h('p', `${t('Date')}: ${fmtDateTime(appt.datetime)}`),
      h('p', `${t('Purpose')}: ${appt.purpose || ''}`),
      h('p', `${t('Status')}: ${appt.status}`),
      appt.outcome_notes && h('p', `${t('Outcome')}: ${appt.outcome_notes}`)
    ]);
    el.appendChild(card);
  } catch (e) {
    toast('Failed to load visit summary');
    console.error(e);
  }
}
