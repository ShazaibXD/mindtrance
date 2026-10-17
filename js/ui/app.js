/* Application core: hash router, page registry, event delegation, toasts, dialogs, theme. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;

  ui.pages = {};
  ui.actions = {};
  ui.forms = {};
  ui.drafts = {};
  ui.store = MT.store.create();
  ui.registerPage = (def) => { ui.pages[def.name] = def; };

  function parseHash() {
    const raw = (location.hash || '#/').slice(1);
    const [path, q] = raw.split('?');
    const params = {};
    new URLSearchParams(q || '').forEach((v, k) => { params[k] = v; });
    return { path: path || '/', params };
  }
  const goto = (hash) => { if (location.hash === hash) ui.render(); else location.hash = hash; };
  ui.go = goto;
  ui.link = (name, params) => '#/app/' + name + (params ? '?' + new URLSearchParams(params).toString() : '');

  /* ---------- theme ---------- */
  ui.applyTheme = function () {
    let theme = 'dark';
    try {
      theme = ui.store.profile() ? ui.store.settings().theme : (localStorage.getItem('mindtrace.theme') || 'dark');
    } catch (e) { /* storage unavailable */ }
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  };
  ui.setTheme = function (theme) {
    try { localStorage.setItem('mindtrace.theme', theme); } catch (e) { /* ignore */ }
    if (ui.store.profile()) ui.store.updateSettings({ theme });
    ui.applyTheme();
  };

  /* ---------- toast and dialog ---------- */
  ui.toast = function (msg, kind) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };

  ui.confirm = function (opts) {
    return new Promise((resolve) => {
      const root = document.getElementById('modal-root');
      const prev = document.activeElement;
      root.innerHTML = '<div class="scrim" data-scrim><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">'
        + '<h2 id="dlg-title">' + ui.esc(opts.title) + '</h2><p id="dlg-body" class="muted">' + ui.esc(opts.body) + '</p>'
        + '<div class="actions"><button class="btn" type="button" data-dlg="no">Cancel</button>'
        + '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" type="button" data-dlg="yes">' + ui.esc(opts.confirmLabel || 'Confirm') + '</button></div></div></div>';
      const close = (v) => { root.innerHTML = ''; document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); resolve(v); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        if (e.key === 'Tab') {
          const btns = [...root.querySelectorAll('button')];
          const i = btns.indexOf(document.activeElement);
          e.preventDefault();
          btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      root.querySelector('[data-dlg="no"]').addEventListener('click', () => close(false));
      root.querySelector('[data-dlg="yes"]').addEventListener('click', () => close(true));
      root.querySelector('[data-dlg="no"]').focus();
    });
  };

  /* ---------- rendering ---------- */
  let lastPath = null;

  function notFound() {
    return '<main id="main" class="container section"><div class="empty"><h1 tabindex="-1" id="page-title">Page not found</h1><p>That page does not exist.</p><a class="btn primary" href="#/">Back to start</a></div></main>';
  }

  ui.render = function () {
    const route = parseHash();
    ui.route = route;
    const root = document.getElementById('app');
    const activeKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    const scrollY = route.path === lastPath ? window.scrollY : 0;
    let html;
    let page = null;
    ui.applyTheme();

    if (route.path === '/' ) { page = ui.pages.landing; }
    else if (route.path === '/signin') { page = ui.pages.auth; }
    else if (route.path.startsWith('/app/')) {
      const name = route.path.slice(5);
      page = ui.pages[name];
      if (page && page.protected !== false && !ui.store.profile()) {
        location.replace('#/signin?next=' + encodeURIComponent(location.hash.slice(1)));
        return;
      }
    }

    try {
      html = page ? (page.shell === false ? page.render(route) : ui.shell(page, route)) : notFound();
    } catch (err) {
      console.error(err);
      html = '<main id="main" class="container section"><div class="notice bad">' + ui.icon('alert') + '<div><strong>Something went wrong on this page.</strong><p class="muted">Your progress is saved. Try reloading, or go back to the dashboard.</p></div></div><p style="margin-top:16px"><a class="btn" href="#/app/dashboard">Dashboard</a></p></main>';
    }
    root.innerHTML = html;
    document.title = (page && page.title ? page.title + ' | ' : '') + 'MINDTRACE';

    root.querySelectorAll('[data-draft]').forEach((el) => {
      const v = ui.drafts[el.dataset.draft];
      if (v != null) el.value = v;
    });
    if (page && page.mount) page.mount(root, route);

    if (route.path !== lastPath) {
      window.scrollTo(0, 0);
      const h = root.querySelector('#page-title') || root.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    } else {
      window.scrollTo(0, scrollY);
      const target = ui.focusAfter ? root.querySelector(ui.focusAfter) : (activeKey ? root.querySelector('[data-fk="' + activeKey + '"]') : null);
      if (target) { if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: false }); }
    }
    ui.focusAfter = null;
    lastPath = route.path;
    document.body.classList.remove('nav-open');
  };

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = ui.actions[el.dataset.action];
    if (fn) fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = ui.forms[f.dataset.form];
    if (fn) fn(f, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.draft) ui.drafts[el.dataset.draft] = el.value;
  });
  window.addEventListener('hashchange', () => ui.render());

  ui.actions['toggle-nav'] = () => {
    const open = document.body.classList.toggle('nav-open');
    const b = document.querySelector('[data-action="toggle-nav"]');
    if (b) b.setAttribute('aria-expanded', String(open));
  };
  ui.actions['toggle-theme'] = () => ui.setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  ui.actions['sign-out'] = () => { ui.store.signOut(); ui.drafts = {}; ui.go('#/'); ui.toast('Signed out. Your progress stays saved in this browser.'); };

  ui.boot = function () {
    if (!ui.store.persistent) {
      console.warn('localStorage unavailable: progress will not persist after reload.');
    }
    ui.render();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ui;
})(typeof window !== 'undefined' ? window : globalThis);
