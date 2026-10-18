/* Local profiles. This is not real authentication: no password, nothing leaves the browser. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;
  let tab = null;
  let error = '';

  const nextHash = () => {
    const n = ui.route && ui.route.params.next;
    return n && n.startsWith('/app/') ? '#' + n : '#/app/dashboard';
  };

  ui.startDemo = function () {
    const existing = ui.store.profiles().find((p) => p.demo);
    if (existing) ui.store.signIn(existing.id);
    else {
      let name = 'Judge demo';
      let r = ui.store.signUp(name, { demo: true });
      for (let i = 2; !r.ok && i < 20; i++) r = ui.store.signUp(name + ' ' + i, { demo: true });
    }
    ui.drafts = {};
    ui.go('#/app/workspace?track=eee-transformers&problem=tx-secondary-current');
  };

  function render() {
    const profiles = ui.store.profiles();
    const active = tab || (profiles.length ? 'signin' : 'create');
    const list = profiles.length
      ? '<ul class="list-reset profiles">' + profiles.map((p) => '<li><button class="profile-btn" type="button" data-action="pick-profile" data-id="' + esc(p.id) + '" data-fk="pf-' + esc(p.id) + '"><span class="avatar" aria-hidden="true">' + esc(p.name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(p.name) + '</strong>' + (p.demo ? ' <span class="badge gold">demo</span>' : '') + '<br><span class="faint small">Created ' + ui.ago(p.createdAt) + '</span></span>' + ui.icon('arrow', 16) + '</button></li>').join('') + '</ul>'
      : '<div class="empty"><p>No profiles in this browser yet.</p></div>';
    return '<main id="main" class="auth"><div class="auth-bg" data-vanta aria-hidden="true"></div><div class="auth-card card">'
      + '<a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</a>'
      + '<h1 id="page-title" class="h2">' + (active === 'signin' ? 'Sign in' : 'Create a profile') + '</h1>'
      + '<div class="tabs" role="tablist" aria-label="Account"><button class="tab" role="tab" type="button" aria-selected="' + (active === 'signin') + '" data-action="auth-tab" data-tab="signin">Sign in</button><button class="tab" role="tab" type="button" aria-selected="' + (active === 'create') + '" data-action="auth-tab" data-tab="create">Create profile</button></div>'
      + (active === 'signin' ? '<div class="stack" role="tabpanel"><p class="muted">Choose a profile saved in this browser.</p>' + list + '</div>'
        : '<form class="stack" role="tabpanel" data-form="create-profile" novalidate><div class="field"><label for="pname">Display name</label><input class="input" id="pname" name="name" autocomplete="nickname" maxlength="60" data-draft="auth-name" aria-describedby="pname-err" ' + (error ? 'aria-invalid="true"' : '') + ' required><div id="pname-err" class="error-text" role="alert">' + esc(error) + '</div></div><button class="btn primary" type="submit">Create profile and start</button></form>')
      + '<div class="notice info">' + ui.icon('info') + '<p class="small">Profiles are stored only in this browser and have no password. There is no server yet, so clearing site data deletes your progress. Real authentication is on the roadmap.</p></div>'
      + '<hr class="divider"><div class="row between"><span class="muted small">Just looking?</span><button class="btn gold" type="button" data-action="start-demo">Open the judge demo</button></div>'
      + '</div></main>';
  }

  ui.registerPage({ name: 'auth', title: 'Sign in', shell: false, protected: false, render });
  ui.actions['auth-tab'] = (el) => { tab = el.dataset.tab; error = ''; ui.focusAfter = '[role=tab][aria-selected=true]'; ui.render(); };
  ui.actions['pick-profile'] = (el) => {
    const r = ui.store.signIn(el.dataset.id);
    if (!r.ok) { ui.toast(r.error, 'bad'); return; }
    ui.go(nextHash());
  };
  ui.forms['create-profile'] = (form) => {
    const r = ui.store.signUp(form.elements.name.value);
    if (!r.ok) { error = r.error; ui.focusAfter = '#pname'; ui.render(); return; }
    error = ''; tab = null; ui.drafts['auth-name'] = '';
    ui.go(nextHash());
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
