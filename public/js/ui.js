// public/js/ui.js
// DOM and UI helpers for Saathi

import api from './api.js';
export { api };

export const MOODS = {
  1: '😢',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '😄'
};

const cleanups = [];
export function onLeave(fn) {
  if (typeof fn === 'function') cleanups.push(fn);
}
export function runCleanups() {
  while (cleanups.length) {
    const fn = cleanups.shift();
    try { fn(); } catch (e) { console.error('Cleanup error:', e); }
  }
}

/**
 * Safe DOM element builder (never uses innerHTML with user data).
 * @param {string} tagStr Tag name and optional classes/id (e.g. 'div.container#main')
 * @param {Object|Array|string|Node} [props] Attributes, event listeners, style, or children
 * @param {Array|string|Node} [children] Children nodes or text
 */
export function h(tagStr, props, children) {
  if (arguments.length === 2 && (Array.isArray(props) || typeof props === 'string' || props instanceof Node)) {
    children = props;
    props = null;
  }

  // Parse tag, classes, and id
  let tag = 'div';
  let id = null;
  const classes = [];

  const parts = tagStr.match(/([a-zA-Z0-9_-]+|[.#][a-zA-Z0-9_-]+)/g) || [tagStr];
  for (const part of parts) {
    if (part.startsWith('.')) {
      classes.push(part.slice(1));
    } else if (part.startsWith('#')) {
      id = part.slice(1);
    } else {
      tag = part;
    }
  }

  const el = document.createElement(tag);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');

  if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    for (const [key, val] of Object.entries(props)) {
      if (val === undefined || val === null) continue;
      if (key === 'className' || key === 'class') {
        el.className = el.className ? `${el.className} ${val}`.trim() : String(val);
      } else if (key === 'style' && typeof val === 'object') {
        Object.assign(el.style, val);
      } else if (key === 'style' && typeof val === 'string') {
        el.style.cssText = val;
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'value') {
        el.value = val;
      } else if (key === 'checked') {
        el.checked = Boolean(val);
      } else if (key === 'selected') {
        el.selected = Boolean(val);
      } else if (key === 'disabled') {
        el.disabled = Boolean(val);
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }

  function appendChild(child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(appendChild);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  if (children !== undefined) {
    appendChild(children);
  }

  return el;
}

export function toast(msg, kind = 'ok') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = h('div.toast-wrap');
    document.body.appendChild(wrap);
  }
  const item = h(`div.toast${kind === 'error' ? '.error' : kind === 'warn' ? '.warn' : ''}`, msg);
  wrap.appendChild(item);
  setTimeout(() => {
    item.style.opacity = '0';
    item.style.transition = 'opacity 0.3s';
    setTimeout(() => item.remove(), 300);
  }, 3500);
}

export function modal({ title, body, onOk, okText = 'OK', cancelText = 'Cancel', hideCancel = false }) {
  return new Promise((resolve) => {
    let overlay;
    function close(result) {
      if (overlay) overlay.remove();
      resolve(result);
    }

    const modalBox = h('div.modal', [
      title ? h('h3', title) : null,
      h('div.modal-body', body),
      h('div.modal-actions', [
        !hideCancel ? h('button.btn.btn-ghost', {
          onclick: () => close(null)
        }, cancelText) : null,
        h('button.btn.btn-primary', {
          onclick: async () => {
            if (onOk) {
              const res = await onOk();
              close(res !== undefined ? res : true);
            } else {
              close(true);
            }
          }
        }, okText)
      ].filter(Boolean))
    ]);

    overlay = h('div.overlay', {
      onclick: (e) => {
        if (e.target === overlay) close(null);
      }
    }, modalBox);

    document.body.appendChild(overlay);
  });
}

export function confirmDialog(msg) {
  return modal({
    title: 'Confirm',
    body: h('p', msg),
    okText: 'Yes',
    cancelText: 'No'
  }).then(res => Boolean(res));
}

export function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let hour = parseInt(hStr, 10);
  const min = mStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return `${parseInt(d, 10)} ${monthName} ${y}`;
}

export function fmtDateTime(dtStr) {
  if (!dtStr) return '';
  const [datePart, timePart] = dtStr.split('T');
  return `${fmtDate(datePart)} at ${fmtTime(timePart)}`;
}

export function speak(text, lang = 'en') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  window.speechSynthesis.speak(utter);
}
