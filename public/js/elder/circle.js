// public/js/elder/circle.js
import api from '../api.js';
import { h } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderCircle(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('circle');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  main.appendChild(h('div.center.muted', 'Loading care circle...'));

  try {
    const data = await api.get(`/circles/${cid}/members`);
    main.innerHTML = '';

    main.appendChild(h('h2.big-name', 'My Care Circle'));

    const members = data.members || [];
    members.forEach(m => {
      const card = h('div.big-card', [
        h('div.big-name', m.name),
        h('p', { style: { fontSize: '1.2rem', color: '#0F766E' } }, m.relation || m.role),
        m.phone ? h('p', [
          h('a.btn.btn-ghost', { href: `tel:${m.phone}`, style: { textDecoration: 'none' } }, `📞 Call ${m.phone}`)
        ]) : null
      ]);
      main.appendChild(card);
    });

  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div.big-card', [
      h('p.notice.notice-danger', 'Error loading circle members: ' + err.message)
    ]));
  }
}
