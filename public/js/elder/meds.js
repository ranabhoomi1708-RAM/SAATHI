// public/js/elder/meds.js
import api from '../api.js';
import { h, toast, fmtTime } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderMeds(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('meds');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  main.appendChild(h('div.center.muted', 'Loading schedule...'));

  try {
    const data = await api.get(`/circles/${cid}/today`);
    main.innerHTML = '';

    main.appendChild(h('h2', { style: { marginBottom: '16px' } }, `📅 Today's Medications`));

    const doses = data.doses || [];
    if (doses.length === 0) {
      main.appendChild(h('div.big-card.center', [
        h('p', 'No medications scheduled for today.')
      ]));
      return;
    }

    doses.forEach(d => {
      const isTaken = d.status === 'taken';
      const isPending = d.status === 'pending';

      const statusBadge = isTaken 
        ? h('span.badge.badge-ok', 'Taken') 
        : d.status === 'missed' 
        ? h('span.badge.badge-danger', 'Missed') 
        : d.status === 'skipped'
        ? h('span.badge.badge-gray', 'Skipped')
        : h('span.badge.badge-warn', 'Pending');

      const card = h('div.big-card', [
        h('div.row.spread', [
          h('span.big-time', fmtTime(d.time)),
          statusBadge
        ]),
        h('div.big-name', { style: { marginTop: '4px' } }, [
          d.color ? h('span.pill-swatch', { style: { backgroundColor: d.color } }) : null,
          d.name
        ]),
        h('p', `${d.dosage || ''} • ${d.instructions || ''}`),
        isPending ? h('div.row', { style: { marginTop: '16px' } }, [
          h('button.btn.btn-ok', {
            style: { flex: '2', minHeight: '60px', fontSize: '1.2rem' },
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/doses/${d.log_id}/take`);
                toast('Marked as taken!', 'ok');
                renderElderMeds(el, { me });
              } catch (err) {
                toast(err.message, 'error');
              }
            }
          }, 'Take Now'),
          h('button.btn.btn-ghost', {
            style: { flex: '1', minHeight: '60px' },
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/doses/${d.log_id}/skip`, { note: 'Skipped by elder' });
                toast('Dose skipped', 'warn');
                renderElderMeds(el, { me });
              } catch (err) {
                toast(err.message, 'error');
              }
            }
          }, 'Skip')
        ]) : null
      ]);

      main.appendChild(card);
    });

  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div.big-card', [
      h('p.notice.notice-danger', 'Error loading schedule: ' + err.message)
    ]));
  }
}
