// public/js/family/circle.js
// Family Circle tab

import api from '../api.js';
import { h, toast, modal, confirmDialog, fmtTime, fmtDate, fmtDateTime, onLeave } from '../ui.js';
import { t } from '../i18n.js';

/**
 * Render the Circle tab.
 * @param {HTMLElement} el Container element.
 * @param {Object} ctx Context {cid, role, refresh, circle}
 */
export async function renderCircleTab(el, ctx) {
  el.innerHTML = '';
  const { cid, role, circle } = ctx;

  // Load members
  let members = [];
  try {
    const res = await api.get(`/circles/${cid}/members`);
    members = res.members || [];
  } catch (e) {
    toast('Failed to load members');
    console.error(e);
  }

  // Join code (admin only)
  const joinCodeSection = role === 'admin' ? h('div', [
    h('h3', t('Join Code')),
    h('p', circle.join_code),
    h('button.btn.btn-primary', {
      onclick: async () => {
        try {
          const { join_code } = await api.post(`/circles/${cid}/rotate-code`);
          toast(t('Code rotated'));
          // Refresh to show new code
          await ctx.refresh();
        } catch (e) { toast('Rotate failed'); }
      }
    }, t('Rotate Code')),
    h('button.btn.btn-ghost', {
      onclick: () => {
        navigator.clipboard.writeText(circle.join_code).then(() => toast(t('Copied')));
      }
    }, t('Copy'))
  ]) : null;

  // Members table
  const table = h('table.circle-members', [
    h('thead', h('tr', [
      h('th', t('Name')),
      h('th', t('Relation')),
      h('th', t('Role')),
      h('th', t('Status')),
      role !== 'viewer' && h('th', t('Actions'))
    ])),
    h('tbody', members.map(m =>
      h('tr', [
        h('td', m.name),
        h('td', m.relation || ''),
        h('td', m.role),
        h('td', m.status),
        role !== 'viewer' && h('td', [
          h('button.btn.btn-primary', {
            onclick: async () => {
              const newRole = await modal({
                title: t('Change Role'),
                body: h('select', {
                  onchange: e => e.target.value
                }, ['admin','editor','viewer'].map(r => h('option', { value: r, selected: r===m.role }, r)))
              });
              // Simplified: not actually sending change
            }
          }, t('Edit')),
          h('button.btn.btn-danger', {
            onclick: async () => {
              const ok = await confirmDialog(t('Revoke member?'));
              if (ok) {
                try {
                  await api.patch(`/circles/${cid}/members/${m.id}`, { status: 'revoked' });
                  await ctx.refresh();
                } catch (e) { toast('Revoke failed'); }
              }
            }
          }, t('Revoke'))
        ])
      ])
    ))
  ]);

  // Notification toggle for current user
  const notifToggle = h('div', [
    h('label', [
      h('input', {
        type: 'checkbox',
        checked: ctx.me.notify_upcoming === 1,
        onchange: async e => {
          try {
            await api.patch(`/circles/${cid}/members/me/prefs`, { notify_upcoming: e.target.checked ? 1 : 0 });
            toast(t('Preference saved'));
          } catch (err) { toast('Failed'); }
        }
      }),
      t('Notify upcoming appointments')
    ])
  ]);

  // Leave circle button (if not admin)
  const leaveBtn = role !== 'admin' ? h('button.btn.btn-danger', {
    onclick: async () => {
      const ok = await confirmDialog(t('Leave this circle?'));
      if (ok) {
        try {
          await api.delete(`/circles/${cid}/members/me`);
          window.location.hash = '#/setup';
        } catch (e) { toast('Leave failed'); }
      }
    }
  }, t('Leave Circle')) : null;

  // Append sections
  if (joinCodeSection) el.appendChild(joinCodeSection);
  el.appendChild(table);
  el.appendChild(notifToggle);
  if (leaveBtn) el.appendChild(leaveBtn);
}
