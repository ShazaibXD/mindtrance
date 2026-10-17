/* Settings: account, preferences, theme, optional Gemini key, data. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;
  let nameError = '';

  function render() {
    const store = ui.store;
    const p = store.profile();
    const s = store.settings();
    const focus = ['<option value="">No preference</option>'].concat(MT.data.domains.map((d) => '<option value="' + esc(d.id) + '"' + (s.examFocus === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>')).join('');
    return '<div class="page-head"><div><p class="eyebrow">Settings</p><h1 id="page-title" class="h1">Account and preferences</h1></div></div>'
      + '<section class="card" aria-labelledby="acc-h"><div class="card-head"><h2 id="acc-h">Account</h2><span class="badge">' + (p.demo ? 'Judge demo profile' : 'Local profile') + '</span></div>'
      + '<form class="stack" data-form="rename" novalidate><div class="field"><label for="set-name">Display name</label><input class="input" id="set-name" name="name" value="' + esc(p.name) + '" maxlength="60" aria-describedby="set-name-err"' + (nameError ? ' aria-invalid="true"' : '') + '><div class="error-text" id="set-name-err" role="alert">' + esc(nameError) + '</div></div>'
      + '<div class="row"><button class="btn" type="submit">Save name</button><button class="btn ghost" type="button" data-action="sign-out">Sign out</button></div></form>'
      + '<p class="hint" style="margin-top:12px">This profile exists only in this browser and has no password. Created ' + new Date(p.createdAt).toLocaleDateString() + '.</p></section>'
      + '<section class="card" aria-labelledby="pref-h"><h2 id="pref-h" style="margin-bottom:12px">Learning preferences</h2><div class="stack">'
      + '<div class="field" style="max-width:360px"><label for="set-focus">Exam focus</label><select class="select" id="set-focus" data-change="set-focus">' + focus + '</select><div class="hint">Recommended problems and recoveries start from this domain when you have not chosen one.</div></div>'
      + '<label class="check"><input type="checkbox" data-change="set-solution"' + (s.showSolution ? ' checked' : '') + '><span>Show the worked solution after a correct attempt</span></label></div></section>'
      + '<section class="card" aria-labelledby="th-h"><h2 id="th-h" style="margin-bottom:12px">Appearance</h2><div class="field" style="max-width:240px"><label for="set-theme">Theme</label><select class="select" id="set-theme" data-change="set-theme"><option value="dark"' + (s.theme !== 'light' ? ' selected' : '') + '>Dark</option><option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>Light</option></select></div></section>'
      + '<section class="card" aria-labelledby="ai-h"><div class="card-head"><h2 id="ai-h">Optional: Gemini for unrecognised answers</h2><span class="badge' + (s.useGemini && s.geminiKey ? ' sage' : '') + '">' + (s.useGemini && s.geminiKey ? 'On' : 'Off') + '</span></div>'
      + '<div class="notice warn">' + ui.icon('alert') + '<p class="small">Your key is saved in this browser\'s localStorage as plain text and requests go straight from your browser to Google. Use a restricted key and do not use this on a shared computer. The Gemini path is schema-validated and unit-tested with mocked responses, but has not been exercised against the live API in this build.</p></div>'
      + '<form class="stack" data-form="gemini" style="margin-top:14px" novalidate><label class="check"><input type="checkbox" name="use" ' + (s.useGemini ? 'checked' : '') + '><span>Ask Gemini when the rule-based engine has no signature for an answer</span></label>'
      + '<div class="field" style="max-width:420px"><label for="set-key">Gemini API key</label><input class="input mono" id="set-key" name="key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (s.geminiKey ? 'Key saved (hidden). Type to replace.' : 'Paste your own key') + '"><div class="hint">Correctness is always checked deterministically. Gemini only suggests the error category and suspected concept.</div></div>'
      + '<div class="row"><button class="btn" type="submit">Save</button>' + (s.geminiKey ? '<button class="btn danger" type="button" data-action="forget-key">Remove saved key</button>' : '') + '</div></form></section>'
      + '<section class="card" aria-labelledby="data-h"><h2 id="data-h" style="margin-bottom:12px">Your data</h2><div class="row"><button class="btn" type="button" data-action="export-data">Export as JSON</button><button class="btn danger" type="button" data-action="reset-progress">Reset progress</button>' + (p.demo ? '' : '<button class="btn danger" type="button" data-action="delete-profile">Delete this profile</button>') + '</div><p class="hint" style="margin-top:10px">The export leaves out your API key.</p></section>';
  }

  ui.registerPage({ name: 'settings', title: 'Settings', nav: { label: 'Settings', icon: 'settings', order: 6 }, render });

  ui.forms.rename = (form) => {
    const r = ui.store.renameProfile(form.elements.name.value);
    nameError = r.ok ? '' : r.error;
    if (r.ok) ui.toast('Name saved.', 'good'); else ui.focusAfter = '#set-name';
    ui.render();
  };
  ui.actions['set-focus'] = (el) => { ui.store.updateSettings({ examFocus: el.value }); ui.toast('Exam focus saved.'); };
  ui.actions['set-solution'] = (el) => { ui.store.updateSettings({ showSolution: el.checked }); ui.toast('Preference saved.'); };
  ui.actions['set-theme'] = (el) => { ui.setTheme(el.value); ui.render(); };
  ui.forms.gemini = (form) => {
    const key = form.elements.key.value.trim();
    const patch = { useGemini: form.elements.use.checked };
    if (key) patch.geminiKey = key;
    if (patch.useGemini && !(key || ui.store.settings().geminiKey)) { ui.toast('Paste a key first, or turn the option off.', 'bad'); return; }
    ui.store.updateSettings(patch);
    ui.toast('Gemini settings saved.', 'good');
    ui.render();
  };
  ui.actions['forget-key'] = () => { ui.store.updateSettings({ geminiKey: '', useGemini: false }); ui.toast('Key removed.'); ui.render(); };
  ui.actions['export-data'] = () => {
    const blob = new Blob([ui.store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mindtrace-progress.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  ui.actions['reset-progress'] = async () => {
    if (await ui.confirm({ title: 'Reset all progress?', body: 'This deletes mastery estimates, events and sessions for this profile. It cannot be undone.', confirmLabel: 'Reset progress', danger: true })) {
      ui.store.resetProgress(); ui.drafts = {}; ui.toast('Progress reset.'); ui.render();
    }
  };
  ui.actions['delete-profile'] = async () => {
    if (await ui.confirm({ title: 'Delete this profile?', body: 'The profile and all of its data will be removed from this browser.', confirmLabel: 'Delete profile', danger: true })) {
      ui.store.deleteProfile(ui.store.profile().id); ui.go('#/');
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
