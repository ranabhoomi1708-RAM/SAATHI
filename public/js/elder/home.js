// public/js/elder/home.js
import api from '../api.js';
import { h, toast, speak, fmtTime } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderHome(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('home');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  main.appendChild(h('div.center.muted', 'Loading medicines...'));

  try {
    const data = await api.get(`/circles/${cid}/today`);
    main.innerHTML = '';

    const summary = data.summary || { total: 0, taken: 0 };
    const pct = summary.total > 0 ? Math.round((summary.taken / summary.total) * 100) : 100;

    // Progress bar
    const progressCard = h('div.card', [
      h('div.row.spread', [
        h('span', { style: { fontWeight: '700' } }, `Today's Progress`),
        h('span.badge.badge-ok', `${summary.taken} of ${summary.total} taken`)
      ]),
      h('div.elder-progress', { style: { marginTop: '8px' } }, [
        h('div', { style: { width: `${pct}%` } })
      ])
    ]);
    main.appendChild(progressCard);

    // Next dose
    const nextDose = data.next;
    if (nextDose) {
      const takeBtn = h('button.btn.btn-giant.btn-ok', {
        onclick: async () => {
          takeBtn.disabled = true;
          try {
            await api.post(`/circles/${cid}/doses/${nextDose.log_id}/take`);
            toast('Dose taken! Well done!', 'ok');
            speak('Medicine recorded. Well done!', 'en');
            renderElderHome(el, { me });
          } catch (e) {
            toast(e.message || 'Error recording dose', 'error');
            takeBtn.disabled = false;
          }
        }
      }, '✅ TAKE MEDICINE NOW');

      const nextCard = h('div.big-card', [
        h('div.row.spread', [
          h('div.big-time', fmtTime(nextDose.time)),
          nextDose.is_due ? h('span.badge.badge-danger', 'DUE NOW') : h('span.badge.badge-info', 'UPCOMING')
        ]),
        h('div.big-name', { style: { marginTop: '8px' } }, [
          nextDose.color ? h('span.pill-swatch', { style: { backgroundColor: nextDose.color } }) : null,
          nextDose.name
        ]),
        h('p', { style: { fontSize: '1.3rem', margin: '8px 0' } }, `${nextDose.dosage || ''} • ${nextDose.instructions || ''}`),
        nextDose.purpose ? h('p.muted', `For: ${nextDose.purpose}`) : null,
        h('div', { style: { marginTop: '16px' } }, [
          takeBtn
        ]),
        h('div.row', { style: { marginTop: '12px', gap: '8px' } }, [
          h('button.btn.btn-ghost', {
            style: { flex: '1', minHeight: '52px' },
            onclick: () => {
              speak(`Time for ${nextDose.name}, ${nextDose.dosage || ''}, ${nextDose.instructions || ''}`, 'en');
            }
          }, '🔊 Speak Name'),
          h('button.btn.btn-ghost', {
            style: { flex: '1', minHeight: '52px' },
            onclick: async () => {
              try {
                await api.post(`/circles/${cid}/doses/${nextDose.log_id}/snooze`, { minutes: 15 });
                toast('Snoozed for 15 minutes', 'ok');
                renderElderHome(el, { me });
              } catch (e) {
                toast(e.message || 'Snooze failed', 'error');
              }
            }
          }, '⏰ Remind in 15m')
        ])
      ]);

      main.appendChild(nextCard);
    } else {
      main.appendChild(h('div.big-card.center', [
        h('div', { style: { fontSize: '4rem', margin: '16px 0' } }, '🎉'),
        h('h2.big-name', 'All caught up!'),
        h('p', 'You have taken all your scheduled medicines for now.')
      ]));
    }

  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div.big-card', [
      h('p.notice.notice-danger', 'Failed to load medicines: ' + err.message),
      h('button.btn.btn-primary', { onclick: () => renderElderHome(el, { me }) }, 'Try Again')
    ]));
  }
}
