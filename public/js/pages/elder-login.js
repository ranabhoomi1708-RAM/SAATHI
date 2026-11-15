// public/js/pages/elder-login.js
import api from '../api.js';
import { h, toast } from '../ui.js';
import { t } from '../i18n.js';

export function renderElderLogin(el) {
  el.innerHTML = '';
  document.body.className = 'elder';

  let pin = '';
  const maxPinLen = 4;

  const codeInput = h('input', {
    type: 'text',
    required: true,
    placeholder: 'e.g. KAMLA726',
    style: { textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }
  });

  const pinDots = [h('span'), h('span'), h('span'), h('span')];
  const pinDotsContainer = h('div.pin-dots', pinDots);

  function updatePinDisplay() {
    pinDots.forEach((dot, idx) => {
      if (idx < pin.length) {
        dot.className = 'on';
      } else {
        dot.className = '';
      }
    });
  }

  async function attemptLogin() {
    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      toast('Please enter your Circle Code', 'warn');
      return;
    }
    if (pin.length !== maxPinLen) {
      toast('Please enter 4-digit PIN', 'warn');
      return;
    }

    try {
      const res = await api.post('/auth/elder-login', { code, pin });
      toast(`Namaste ${res.circle.elder_name}!`);
      window.location.hash = '#/elder';
    } catch (err) {
      toast(err.message || 'Wrong code or PIN', 'error');
      pin = '';
      updatePinDisplay();
    }
  }

  function handleDigit(digit) {
    if (pin.length < maxPinLen) {
      pin += digit;
      updatePinDisplay();
      if (pin.length === maxPinLen && codeInput.value.trim()) {
        attemptLogin();
      }
    }
  }

  function handleClear() {
    pin = '';
    updatePinDisplay();
  }

  // Keypad
  const keypad = h('div.keypad', [
    h('button', { type: 'button', onclick: () => handleDigit('1') }, '1'),
    h('button', { type: 'button', onclick: () => handleDigit('2') }, '2'),
    h('button', { type: 'button', onclick: () => handleDigit('3') }, '3'),
    h('button', { type: 'button', onclick: () => handleDigit('4') }, '4'),
    h('button', { type: 'button', onclick: () => handleDigit('5') }, '5'),
    h('button', { type: 'button', onclick: () => handleDigit('6') }, '6'),
    h('button', { type: 'button', onclick: () => handleDigit('7') }, '7'),
    h('button', { type: 'button', onclick: () => handleDigit('8') }, '8'),
    h('button', { type: 'button', onclick: () => handleDigit('9') }, '9'),
    h('button', { type: 'button', onclick: handleClear, style: { fontSize: '1.2rem', color: '#B91C1C' } }, 'Clear'),
    h('button', { type: 'button', onclick: () => handleDigit('0') }, '0'),
    h('button', { type: 'button', onclick: attemptLogin, style: { fontSize: '1.2rem', background: '#0F766E', color: '#fff' } }, 'OK')
  ]);

  const view = h('div.elder-main', [
    h('div.big-card.center', [
      h('h1.big-name', '👵 Elder Easy Login'),
      h('p.muted', 'Enter your Circle Code and 4-digit PIN:'),
      h('div', { style: { maxWidth: '300px', margin: '0 auto 16px' } }, [
        h('label', 'Circle Code'),
        codeInput
      ]),
      h('label', '4-Digit PIN'),
      pinDotsContainer,
      keypad,
      h('div', { style: { marginTop: '24px' } }, [
        h('a.btn.btn-ghost', { href: '#/login', style: { minHeight: '44px', fontSize: '1rem' } }, '← Back to Family Login')
      ])
    ])
  ]);

  el.appendChild(view);
}
