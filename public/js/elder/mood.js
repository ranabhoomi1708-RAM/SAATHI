// public/js/elder/mood.js
import api from '../api.js';
import { h, toast } from '../ui.js';
import { renderElderHeader, renderElderNav } from './common.js';

export async function renderElderMood(el, { me }) {
  el.innerHTML = '';
  document.body.className = 'elder';

  const cid = me?.circle?.id || 1;
  const elderName = me?.circle?.elder_name || 'Elder';

  const header = renderElderHeader(elderName);
  const main = h('main.elder-main');
  const nav = renderElderNav('mood');

  el.appendChild(header);
  el.appendChild(main);
  el.appendChild(nav);

  const moodOptions = [
    { value: 5, emoji: '😄', label: 'Very Good' },
    { value: 4, emoji: '🙂', label: 'Good' },
    { value: 3, emoji: '😐', label: 'Okay' },
    { value: 2, emoji: '🙁', label: 'Not Good' },
    { value: 1, emoji: '😢', label: 'Unwell' }
  ];

  async function recordMood(val) {
    try {
      await api.post(`/circles/${cid}/mood`, { mood: val });
      toast('Thank you! Mood saved for family to see.', 'ok');
      renderElderMood(el, { me });
    } catch (err) {
      toast(err.message || 'Error saving mood', 'error');
    }
  }

  const moodButtons = moodOptions.map(m => {
    return h('button.mood-btn', {
      type: 'button',
      onclick: () => recordMood(m.value)
    }, [
      h('div', m.emoji),
      h('small', m.label)
    ]);
  });

  const card = h('div.big-card.center', [
    h('h2.big-name', 'How are you feeling right now?'),
    h('p.muted', 'Tap an emoji to let your family know how you feel today:'),
    h('div.mood-grid', { style: { marginTop: '24px' } }, moodButtons)
  ]);

  main.appendChild(card);
}
