// public/js/pages/setup.js
import api from '../api.js';
import { h, toast } from '../ui.js';

export function renderSetup(el, { me }) {
  el.innerHTML = '';
  document.body.className = '';

  const existingCircles = (me && me.circles) || [];

  // Create Circle Form
  const elderNameInput = h('input', { type: 'text', required: true, placeholder: 'e.g. Kamla Devi' });
  const elderAgeInput = h('input', { type: 'number', placeholder: 'e.g. 74' });
  const relationInput = h('input', { type: 'text', required: true, placeholder: 'e.g. Son, Daughter, Caretaker' });
  const pinInput = h('input', { type: 'password', required: true, maxLength: 4, placeholder: '4 digits (e.g. 1234)' });
  const langSelect = h('select', {}, [
    h('option', { value: 'en' }, 'English'),
    h('option', { value: 'hi' }, 'हिन्दी (Hindi)')
  ]);

  const createForm = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const pin = pinInput.value.trim();
      if (!/^\d{4}$/.test(pin)) {
        toast('PIN must be exactly 4 digits', 'warn');
        return;
      }
      try {
        const res = await api.post('/circles', {
          elder_name: elderNameInput.value.trim(),
          elder_age: elderAgeInput.value ? parseInt(elderAgeInput.value, 10) : undefined,
          relation: relationInput.value.trim(),
          elder_pin: pin,
          language: langSelect.value
        });
        toast('Care Circle created!');
        window.location.hash = `#/app/${res.circle.id}/overview`;
      } catch (err) {
        toast(err.message || 'Failed to create circle', 'error');
      }
    }
  }, [
    h('label', "Elder's Full Name"),
    elderNameInput,
    h('label', "Elder's Age (optional)"),
    elderAgeInput,
    h('label', "Your Relationship to Elder"),
    relationInput,
    h('label', "Elder Login PIN (4 digits)"),
    pinInput,
    h('label', "Preferred Language"),
    langSelect,
    h('button.btn.btn-primary', { type: 'submit', style: { width: '100%', marginTop: '16px' } }, 'Create Circle')
  ]);

  // Join Circle Form
  const codeInput = h('input', { type: 'text', required: true, placeholder: 'e.g. KAMLA726', style: { textTransform: 'uppercase' } });
  const joinRelationInput = h('input', { type: 'text', required: true, placeholder: 'e.g. Grandson, Neighbor' });
  const roleSelect = h('select', {}, [
    h('option', { value: 'editor' }, 'Editor (Can manage medicines & doses)'),
    h('option', { value: 'viewer' }, 'Viewer (Read-only view)')
  ]);

  const joinForm = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        const res = await api.post('/circles/join', {
          code: codeInput.value.trim().toUpperCase(),
          relation: joinRelationInput.value.trim(),
          requested_role: roleSelect.value
        });
        toast(`Request submitted! Status: ${res.status}`);
        const meRes = await api.get('/auth/me');
        if (meRes.circles && meRes.circles.length > 0) {
          window.location.hash = `#/app/${meRes.circles[0].id}/overview`;
        } else {
          toast('Waiting for admin approval', 'warn');
        }
      } catch (err) {
        toast(err.message || 'Failed to join circle', 'error');
      }
    }
  }, [
    h('label', "Circle Join Code"),
    codeInput,
    h('label', "Your Relationship"),
    joinRelationInput,
    h('label', "Requested Access Role"),
    roleSelect,
    h('button.btn.btn-ok', { type: 'submit', style: { width: '100%', marginTop: '16px' } }, 'Join Circle')
  ]);

  const container = h('div.container', { style: { maxWidth: '800px', marginTop: '24px' } }, [
    h('div.row.spread', [
      h('h1', 'Set Up Your Care Circles'),
      h('button.btn.btn-ghost.btn-sm', {
        onclick: async () => {
          await api.post('/auth/logout');
          window.location.hash = '#/login';
        }
      }, 'Sign Out')
    ]),

    existingCircles.length > 0 ? h('div.card', [
      h('h3', 'Your Existing Circles'),
      h('div.row', existingCircles.map(c => 
        h('a.btn.btn-ghost', { href: `#/app/${c.id}/overview` }, `👵 ${c.elder_name} (${c.role})`)
      ))
    ]) : null,

    h('div.grid.grid-2', [
      h('div.card', [
        h('h3', 'Create a New Circle'),
        h('p.muted', 'Set up care for your parent, grandparent, or elder.'),
        createForm
      ]),
      h('div.card', [
        h('h3', 'Join an Existing Circle'),
        h('p.muted', 'Enter the code shared with you by a family member.'),
        joinForm
      ])
    ])
  ]);

  el.appendChild(container);
}
