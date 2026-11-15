// public/js/pages/landing.js
import { h } from '../ui.js';
import { t } from '../i18n.js';

export function renderLanding(el) {
  el.innerHTML = '';
  document.body.className = '';

  const hero = h('div.container.center', { style: { padding: '40px 16px', maxWidth: '700px' } }, [
    h('div', { style: { fontSize: '3rem', marginBottom: '16px' } }, '🤝'),
    h('h1', 'Saathi'),
    h('p.muted', { style: { fontSize: '1.25rem', marginBottom: '32px' } }, 
      'Elder care, together. Medication reminders, doctor visits, health logs, and emergency support for your family.'
    ),
    h('div.card', { style: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' } }, [
      h('h2', 'Welcome'),
      h('p', 'Are you a family member or an elder?'),
      h('div.row.center', { style: { justifyContent: 'center', gap: '16px' } }, [
        h('a.btn.btn-primary', { href: '#/login' }, 'Family / Caretaker Login'),
        h('a.btn.btn-ok', { href: '#/elder-login' }, '👵 Elder Easy Mode')
      ]),
      h('div', { style: { marginTop: '12px' } }, [
        h('span.muted', 'New to Saathi? '),
        h('a', { href: '#/register' }, 'Create an account')
      ])
    ])
  ]);

  el.appendChild(hero);
}
