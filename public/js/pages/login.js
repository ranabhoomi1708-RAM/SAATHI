// public/js/pages/login.js
import api from '../api.js';
import { h, toast } from '../ui.js';
import { t } from '../i18n.js';

export function renderLogin(el) {
  el.innerHTML = '';
  document.body.className = '';

  const emailInput = h('input', {
    type: 'email',
    required: true,
    placeholder: 'e.g. family@demo.com',
    autocomplete: 'email'
  });

  const passInput = h('input', {
    type: 'password',
    required: true,
    placeholder: '••••••••',
    autocomplete: 'current-password'
  });

  const submitBtn = h('button.btn.btn-primary', { type: 'submit', style: { width: '100%', marginTop: '16px' } }, 'Sign In');

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      try {
        const res = await api.post('/auth/login', {
          email: emailInput.value.trim(),
          password: passInput.value
        });
        toast('Welcome back, ' + res.user.name + '!');
        
        // Fetch /auth/me to see user's circles
        const meRes = await api.get('/auth/me');
        if (meRes.circles && meRes.circles.length > 0) {
          const firstCircle = meRes.circles[0];
          window.location.hash = `#/app/${firstCircle.id}/overview`;
        } else {
          window.location.hash = '#/setup';
        }
      } catch (err) {
        toast(err.message || 'Login failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    }
  }, [
    h('label', 'Email Address'),
    emailInput,
    h('label', 'Password'),
    passInput,
    submitBtn
  ]);

  const card = h('div.container', { style: { maxWidth: '440px', marginTop: '40px' } }, [
    h('div.card', [
      h('h2.center', 'Family Sign In'),
      h('p.muted.center', 'Log in to manage medications and care for your elder.'),
      form,
      h('div.center', { style: { marginTop: '20px' } }, [
        h('span.muted', "Don't have an account? "),
        h('a', { href: '#/register' }, 'Sign Up')
      ]),
      h('div.center', { style: { marginTop: '12px' } }, [
        h('a.muted', { href: '#/elder-login' }, '👵 Elder Easy Mode Login')
      ])
    ])
  ]);

  el.appendChild(card);
}
