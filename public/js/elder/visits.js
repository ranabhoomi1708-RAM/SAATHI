// public/js/elder/visits.js
import api from '../api.js';
import { h, fmtDateTime } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderVisits(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('visits');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  main.appendChild(h('div.center.muted', 'Loading doctor visits...'));

  try {
    const data = await api.get(`/circles/${cid}/appointments?status=upcoming`);
    main.innerHTML = '';

    main.appendChild(h('h2', { style: { marginBottom: '16px' } }, `🩺 Doctor Appointments`));

    const appts = data.appointments || [];
    if (appts.length === 0) {
      main.appendChild(h('div.big-card.center', [
        h('p', 'No upcoming doctor visits.')
      ]));
      return;
    }

    appts.forEach(a => {
      const card = h('div.big-card', [
        h('div.big-name', a.doctor),
        a.specialty ? h('p.muted', a.specialty) : null,
        h('p', { style: { fontSize: '1.3rem', fontWeight: 'bold', color: '#0F766E' } }, fmtDateTime(a.datetime)),
        a.location ? h('p', `📍 ${a.location}`) : null,
        a.accompanied_by ? h('div.notice.notice-ok', `Going with: ${a.accompanied_by}`) : h('div.notice.notice-warn', 'No companion claimed yet')
      ]);
      main.appendChild(card);
    });

  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div.big-card', [
      h('p.notice.notice-danger', 'Error loading visits: ' + err.message)
    ]));
  }
}
