/* Authenticated app shell: sidebar navigation, profile chip, mobile drawer. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;

  ui.STATE_LABEL = {
    READY: 'Ready for an attempt', ATTEMPT_SUBMITTED: 'Attempt submitted', ATTEMPT_CORRECT: 'Solved', ERROR_CLASSIFIED: 'Error classified',
    PROBE_REQUIRED: 'Probe pending', GAP_CONFIRMED: 'Gap confirmed', RECOVERY_REQUIRED: 'Recovery needed', RECOVERY_IN_PROGRESS: 'Recovery in progress',
    VERIFICATION_REQUIRED: 'Verification pending', MASTERY_VERIFIED: 'Mastery verified', RETRY_REQUIRED: 'Ready to retry',
  };

  /* "About this page" card. Dismissal is remembered per browser; a small link brings it back. */
  const HIDE_KEY = 'mindtrace.intro.hidden';
  const hidden = () => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || '[]'); } catch (e) { return ui.introHidden || []; } };
  ui.intro = function (key, title, body, opts) {
    const o = opts || {};
    if (hidden().includes(key)) {
      return '<p class="intro-reopen"><button class="linkbtn small" type="button" data-action="intro-show" data-key="' + ui.esc(key) + '">' + ui.icon('info', 14) + ' What is this page?</button></p>';
    }
    return '<section class="card intro" aria-labelledby="intro-' + ui.esc(key) + '"><div class="intro-ic" aria-hidden="true">' + ui.icon('info', 20) + '</div><div class="intro-body">'
      + '<h2 id="intro-' + ui.esc(key) + '" class="intro-title">' + ui.esc(title) + '</h2>' + body
      + (o.steps ? '<ol class="intro-steps">' + o.steps.map((x) => '<li>' + x + '</li>').join('') + '</ol>' : '')
      + '<p class="intro-foot"><a href="#/app/guide">Read the full guide</a><button class="linkbtn" type="button" data-action="intro-hide" data-key="' + ui.esc(key) + '">Got it, hide this</button></p></div></section>';
  };
  ui.firstRun = function () {
    const steps = [
      ['Pick a problem', 'Open one from the Workspace, or type your own question under Ask anything.'],
      ['Answer it, and show your working', 'A wrong answer is fine. It is what MINDTRACE learns from.'],
      ['Read the diagnosis', 'It says whether it was a slip or a missing concept, and why, in plain words.'],
      ['Fix the cause, then prove it', 'A short lesson, then a fresh problem. The map updates when you pass.'],
    ];
    return '<section class="card firstrun" aria-labelledby="fr-h"><p class="eyebrow">New here? Start with this</p><h2 id="fr-h" class="h2">Four steps, about three minutes</h2><ol class="fr-steps list-reset">'
      + steps.map((s, i) => '<li><span class="gnum" aria-hidden="true">' + (i + 1) + '</span><div><strong>' + ui.esc(s[0]) + '</strong><p class="small muted">' + ui.esc(s[1]) + '</p></div></li>').join('')
      + '</ol><p class="small"><a href="#/app/guide">Read the full guide</a> for what every word and colour means. Your first step is just below.</p></section>';
  };
  const setHidden = (key, on) => {
    let list = hidden().filter((k) => k !== key);
    if (on) list.push(key);
    ui.introHidden = list;
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
    ui.render();
  };
  ui.actions['intro-hide'] = (el) => setHidden(el.dataset.key, true);
  ui.actions['intro-show'] = (el) => setHidden(el.dataset.key, false);

  ui.shell = function (page, route) {
    const profile = ui.store.profile();
    const items = Object.values(ui.pages).filter((p) => p.nav).sort((a, b) => a.nav.order - b.nav.order);
    const nav = items.map((p) => '<li><a class="navitem' + (p.name === page.name ? ' active' : '') + '" href="#/app/' + p.name + '"' + (p.name === page.name ? ' aria-current="page"' : '') + '>' + ui.icon(p.nav.icon, 18) + '<span>' + ui.esc(p.nav.label) + '</span></a></li>').join('');
    return '<div class="app">'
      + '<aside class="sidebar" aria-label="Primary navigation">'
      + '<a class="brand" href="#/" aria-label="MINDTRACE home"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</a>'
      + '<nav aria-label="App sections"><ul class="list-reset navlist">' + nav + '</ul></nav>'
      + '<div class="sidebar-foot">'
      + '<div class="profile-chip"><span class="avatar" aria-hidden="true">' + ui.esc(profile.name.slice(0, 1).toUpperCase()) + '</span><div><div class="pname">' + ui.esc(profile.name) + '</div><div class="faint small">' + (profile.demo ? 'Judge demo profile' : 'Local profile') + '</div></div></div>'
      + '<div class="row"><button class="btn sm ghost" type="button" data-action="toggle-theme" aria-label="Toggle light or dark theme">' + ui.icon('sun', 16) + '</button>'
      + '<button class="btn sm ghost" type="button" data-action="sign-out">' + ui.icon('logout', 16) + ' Sign out</button></div></div></aside>'
      + '<div class="main-col"><header class="mobilebar"><button class="btn sm" type="button" data-action="toggle-nav" aria-expanded="false" aria-label="Open navigation">' + ui.icon('menu', 18) + '</button>'
      + '<span class="brand small"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</span></header>'
      + '<main id="main" class="app-main">' + page.render(route) + '</main></div>'
      + '<div class="nav-scrim" data-action="toggle-nav"></div></div>';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ui.shell;
})(typeof window !== 'undefined' ? window : globalThis);
