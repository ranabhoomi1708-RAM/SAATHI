// public/js/elder/common.js
// Shared header and bottom navigation for Elder Easy Mode
import api from '../api.js';
import { h, speak } from '../ui.js';
import { t, getLang, setLang } from '../i18n.js';

export function renderElderHeader(elderName = 'Kamla Devi') {
  return h('header.elder-header', [
    h('div', [
      h('span', { style: { fontSize: '1.2rem', fontWeight: '800' } }, `👵 ${elderName}`)
    ]),
    h('div.row', { style: { gap: '8px' } }, [
      h('button.btn.btn-ghost.btn-sm', {
        style: { color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' },
        onclick: () => {
          const newLang = getLang() === 'en' ? 'hi' : 'en';
          setLang(newLang);
          window.location.reload();
        }
      }, getLang() === 'en' ? 'हिन्दी' : 'English'),
      h('button.btn.btn-danger.btn-sm', {
        onclick: async () => {
          await api.post('/auth/logout');
          window.location.hash = '#/elder-login';
        }
      }, 'Exit')
    ])
  ]);
}

export function renderElderNav(activeTab = 'home') {
  return h('nav.elder-nav', [
    h('a', { href: '#/elder', className: activeTab === 'home' ? 'active' : '' }, [
      h('span', { style: { fontSize: '1.8rem' } }, '💊'),
      h('span', 'Now')
    ]),
    h('a', { href: '#/elder/meds', className: activeTab === 'meds' ? 'active' : '' }, [
      h('span', { style: { fontSize: '1.8rem' } }, '📅'),
      h('span', 'Today')
    ]),
    h('a', { href: '#/elder/visits', className: activeTab === 'visits' ? 'active' : '' }, [
      h('span', { style: { fontSize: '1.8rem' } }, '🩺'),
      h('span', 'Visits')
    ]),
    h('a', { href: '#/elder/mood', className: activeTab === 'mood' ? 'active' : '' }, [
      h('span', { style: { fontSize: '1.8rem' } }, '😊'),
      h('span', 'Mood')
    ]),
    h('a', { href: '#/elder/help', className: activeTab === 'help' ? 'active' : '' }, [
      h('span', { style: { fontSize: '1.8rem' } }, '🚨'),
      h('span', 'Help')
    ])
  ]);
}
