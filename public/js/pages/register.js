// public/js/pages/register.js
import api from '../api.js';
import { h, toast } from '../ui.js';

export function renderRegister(el) {
  el.innerHTML = '';
  document.body.className = '';

  const nameInput = h('input', {
    type: 'text',
    required: true,
    placeholder: 'e.g. Priya Sharma'
  });

  const emailInput = h('input', {
    type: 'email',
    required: true,
    placeholder: 'e.g. priya@example.com'
  });

  const phoneInput = h('input', {
    type: 'tel',
    placeholder: '+91 98765 43210 (optional)'
  });

  const passInput = h('input', {
    type: 'password',
    required: true,
    placeholder: 'At least 8 characters',
    minLength: 8
  });

  const submitBtn = h('button.btn.btn-primary', { type: 'submit', style: { width: '100%', marginTop: '16px' } }, 'Create Account');

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
      try {
        await api.post('/auth/register', {
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          password: passInput.value,
          phone: phoneInput.value.trim() || undefined
        });
        toast('Account created successfully!');
        window.location.hash = '#/setup';
      } catch (err) {
        toast(err.message || 'Registration failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    }
  }, [
    h('label', 'Full Name'),
    nameInput,
    h('label', 'Email Address'),
    emailInput,
    h('label', 'Phone Number (optional)'),
    phoneInput,
    h('label', 'Password (min. 8 characters)'),
    passInput,
    submitBtn
  ]);

  const card = h('div.container', { style: { maxWidth: '440px', marginTop: '40px' } }, [
    h('div.card', [
      h('h2.center', 'Create Account'),
      h('p.muted.center', 'Join Saathi to coordinate care with your family.'),
      form,
      h('div.center', { style: { marginTop: '20px' } }, [
        h('span.muted', 'Already have an account? '),
        h('a', { href: '#/login' }, 'Sign In')
      ])
    ])
  ]);

  el.appendChild(card);
}
