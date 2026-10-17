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
