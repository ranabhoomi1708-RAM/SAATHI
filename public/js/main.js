// public/js/main.js
// Main router and entry point for Saathi SPA

import api from './api.js';
import { runCleanups } from './ui.js';

import { renderLanding } from './pages/landing.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderElderLogin } from './pages/elder-login.js';
import { renderSetup } from './pages/setup.js';

import { renderElderHome } from './elder/home.js';
import { renderElderMeds } from './elder/meds.js';
import { renderElderVisits } from './elder/visits.js';
import { renderElderMood } from './elder/mood.js';
import { renderElderHelp } from './elder/help.js';
import { renderElderCircle } from './elder/circle.js';

import { renderFamily } from './family/dashboard.js';
import { renderEmergencyCard, renderVisitSummary } from './family/printviews.js';

const appEl = document.getElementById('app');

async function getAuth() {
  try {
    return await api.get('/auth/me');
  } catch (e) {
    return null;
  }
}

async function handleRoute() {
  runCleanups();
  const hash = window.location.hash || '#/';

  // Public routes
  if (hash === '#/' || hash === '') {
    return renderLanding(appEl);
  }
  if (hash === '#/login') {
    return renderLogin(appEl);
  }
  if (hash === '#/register') {
    return renderRegister(appEl);
  }
  if (hash === '#/elder-login') {
    return renderElderLogin(appEl);
  }

  // Emergency card (read access / public)
  const emergencyMatch = hash.match(/^#\/emergency\/(\d+)$/);
  if (emergencyMatch) {
    const cid = parseInt(emergencyMatch[1], 10);
    return renderEmergencyCard(appEl, { cid });
  }

  // Visit summary print view
  const visitMatch = hash.match(/^#\/visit\/(\d+)\/(\d+)$/);
  if (visitMatch) {
    const cid = parseInt(visitMatch[1], 10);
    const aid = parseInt(visitMatch[2], 10);
    return renderVisitSummary(appEl, { cid, aid });
  }

  // Authenticated routes
  const me = await getAuth();

  // Elder routes
  if (hash.startsWith('#/elder')) {
    if (!me || me.kind !== 'elder') {
      window.location.hash = '#/elder-login';
      return;
    }
    if (hash === '#/elder') return renderElderHome(appEl, { me });
    if (hash === '#/elder/meds') return renderElderMeds(appEl, { me });
    if (hash === '#/elder/visits') return renderElderVisits(appEl, { me });
    if (hash === '#/elder/mood') return renderElderMood(appEl, { me });
    if (hash === '#/elder/help') return renderElderHelp(appEl, { me });
    if (hash === '#/elder/circle') return renderElderCircle(appEl, { me });
  }

  // Family / User routes
  if (!me || me.kind !== 'user') {
    window.location.hash = '#/login';
    return;
  }

  if (hash === '#/setup') {
    return renderSetup(appEl, { me });
  }

  // #/app/:cid/:tab
  const appMatch = hash.match(/^#\/app\/(\d+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (appMatch) {
    const cid = parseInt(appMatch[1], 10);
    const tab = appMatch[2] || 'overview';
    return renderFamily(appEl, { me, cid, tab });
  }

  // Default redirect
  if (me.circles && me.circles.length > 0) {
    window.location.hash = `#/app/${me.circles[0].id}/overview`;
  } else {
    window.location.hash = '#/setup';
  }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', handleRoute);
// Run initial route immediately
handleRoute();
