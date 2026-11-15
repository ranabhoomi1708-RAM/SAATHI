// public/js/elder/help.js
import api from '../api.js';
import { h, toast } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderHelp(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('help');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  let sosActive = false;
  try {
    const res = await api.get(`/circles/${cid}/sos/active`);
    sosActive = Boolean(res.sos);
  } catch (e) {
    sosActive = false;
  }

  const sosBtn = h('button.sos-btn', {
    onclick: async () => {
      sosBtn.disabled = true;
      try {
        await api.post(`/circles/${cid}/sos`);
        toast('🚨 SOS Alert Sent to All Family Members!', 'error');
        renderElderHelp(el, { me });
      } catch (err) {
        toast(err.message || 'Failed to send SOS', 'error');
        sosBtn.disabled = false;
      }
    }
  }, sosActive ? '🚨 SOS ACTIVE!\nFAMILY ALERTED' : '🚨 PRESS FOR EMERGENCY SOS');

  const card = h('div.big-card.center', [
    h('h1.big-name', { style: { color: '#B91C1C' } }, 'Emergency Assistance'),
    h('p', 'Press the button below to alert everyone in your care circle immediately:'),
    h('div', { style: { margin: '20px 0' } }, sosBtn)
  ]);

  main.appendChild(card);

  // Emergency contacts and doctor
  try {
    const cardData = await api.get(`/circles/${cid}/emergency-card`);
    const elder = cardData.elder || {};
    const contacts = cardData.contacts || [];

    const detailsCard = h('div.big-card', [
      h('h3.big-name', 'Emergency Contacts'),
      elder.doctor_phone ? h('div.notice.notice-ok', [
        h('strong', `Doctor: ${elder.doctor_name || 'Family Doctor'}`),
        h('br'),
        h('a.btn.btn-ok', {
          href: `tel:${elder.doctor_phone}`,
          style: { minHeight: '52px', marginTop: '8px', fontSize: '1.2rem', textDecoration: 'none' }
        }, `📞 Call ${elder.doctor_phone}`)
      ]) : null,
      contacts.map(c => h('div', { style: { padding: '8px 0', borderBottom: '1px solid #eee' } }, [
        h('div', { style: { fontWeight: 'bold' } }, `${c.name} (${c.relation})`),
        c.phone ? h('a', { href: `tel:${c.phone}`, style: { fontSize: '1.2rem' } }, `📞 ${c.phone}`) : null
      ]))
    ]);
    main.appendChild(detailsCard);
  } catch (e) {
    // Non-critical if emergency card fails to load
  }
}
