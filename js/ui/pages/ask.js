/* Ask anything: type any educational question, get a prerequisite map built for it. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;

  ui.askBusy = false;
  ui.askError = '';
  ui.askClarify = null;

  const EXAMPLES = [
    'Why did the Roman Republic collapse into an empire?',
    'How do supply and demand set the price of a product?',
    'What is the difference between a metaphor and a simile, and why does it matter when analysing a poem?',
    'Why does a heavy object not fall faster than a light one in a vacuum?',
  ];

  function render() {
    const store = ui.store;
    const hasKey = !!store.settings().geminiKey;
    const mine = store.customTracks().slice().sort((a, b) => b.createdAt - a.createdAt);
    const list = mine.length
      ? '<ul class="list">' + mine.map((e) => {
        const t = MT.data.track(e.id);
        const states = store.graphState(e.id);
        const done = t.concepts.filter((c) => states[c.id].status === 'MASTERED').length;
        return '<li><div><strong>' + esc(MT.custom.shorten(e.question)) + '</strong><br><span class="faint small">' + esc(t.subject) + ' &middot; ' + t.concepts.length + ' concepts, ' + done + ' mastered &middot; ' + (e.source === 'fixture' ? 'demo fixture' : 'built by Gemini') + '</span></div>'
          + '<div class="row"><a class="btn sm primary" href="' + ui.link('workspace', { track: e.id, problem: 'q' }) + '">Open</a><a class="btn sm" href="' + ui.link('map', { track: e.id }) + '">Map</a><button class="btn sm danger" type="button" data-action="ask-delete" data-id="' + esc(e.id) + '" aria-label="Delete this question">Delete</button></div></li>';
      }).join('') + '</ul>'
      : '<p class="muted">Nothing yet. Questions you ask appear here, with their own map and progress.</p>';

    return '<div class="page-head"><div><p class="eyebrow">Ask anything</p><h1 id="page-title" class="h1">Start from any question</h1></div></div>'
      + '<section class="card stack" aria-labelledby="ask-h"><h2 id="ask-h" class="h3">Your question</h2>'
      + '<p class="muted">No subject to pick. MINDTRACE breaks the question into a small prerequisite map, you attempt an answer in your own words, and it diagnoses what is missing before it teaches anything.</p>'
      + (hasKey ? '' : '<div class="notice warn" role="status">' + ui.icon('info') + '<div><strong>Building a map for a new question needs a Gemini key.</strong><p class="small">Add your own in <a href="' + ui.link('settings') + '">Settings</a>. Or try the demo question below, which is a scripted fixture and needs no key.</p></div></div>')
      + (ui.askClarify ? '<div class="notice warn" role="status">' + ui.icon('info') + '<div><strong>One quick question first.</strong><p class="small">' + esc(ui.askClarify.question) + '</p></div></div>' : '')
      + '<form class="stack" data-form="ask" novalidate>'
      + '<div class="field"><label for="ask-q">What do you want to understand or answer?</label><textarea class="textarea prose" id="ask-q" name="question" maxlength="600" rows="4" placeholder="For example: Why did the Roman Republic collapse into an empire?" data-draft="ask-q" aria-describedby="ask-hint ask-err" required></textarea><div class="hint" id="ask-hint">A sentence or two, up to 600 characters. Any subject.</div><div class="error-text" id="ask-err" role="alert">' + esc(ui.askError) + '</div></div>'
      + (ui.askClarify ? '<div class="field"><label for="ask-d">Your answer to that</label><textarea class="textarea prose" id="ask-d" name="details" maxlength="300" rows="2" data-draft="ask-d" placeholder="For example: the voltage is 12 V and the resistance is 4 ohms"></textarea></div>' : '')
      + '<div class="chips" role="group" aria-label="Example questions">' + EXAMPLES.map((q, i) => '<button class="chip" type="button" data-action="ask-example" data-i="' + i + '">' + esc(MT.custom.shorten(q)) + '</button>').join('') + '</div>'
      + '<div class="row"><button class="btn primary" type="submit" data-fk="ask-submit"' + (!hasKey || ui.askBusy ? ' disabled' : '') + '>' + (ui.askBusy ? '<span class="spin" aria-hidden="true"></span>Building your map' : 'Build my learning map') + '</button>'
      + (ui.askBusy ? '<span class="hint" role="status">This can take up to a minute.</span>' : '') + '</div></form>'
      + '<p class="hint">Generated content is validated against a strict schema before it is used, but it is AI-written and can be wrong. Open-ended answers are judged by AI and labelled that way. The fresh questions that verify learning are checked deterministically.</p></section>'
      + '<section class="card demo" aria-labelledby="fx-h"><div class="row between"><h2 id="fx-h" class="h3">Try it without a key</h2><span class="badge gold">demo fixture</span></div>'
      + '<p class="muted">A history essay question with a pre-written map. Your answer is graded by a small keyword rubric, <strong>not AI</strong>, so the same loop can be shown offline: weak answer, follow-up question, recovery, fresh question, updated map.</p>'
      + '<p class="math"><em>' + esc(MT.custom.FIXTURE.question) + '</em></p><div><button class="btn gold" type="button" data-action="ask-fixture" data-fk="ask-fixture">Open the demo question</button></div></section>'
      + '<section class="card" aria-labelledby="mine-h"><div class="card-head"><h2 id="mine-h" class="h3">Your questions</h2></div>' + list + '</section>';
  }

  ui.registerPage({ name: 'ask', title: 'Ask anything', nav: { label: 'Ask anything', icon: 'ask', order: 1.5 }, render });

  ui.actions['ask-example'] = (el) => { ui.drafts['ask-q'] = EXAMPLES[Number(el.dataset.i)]; ui.askError = ''; ui.askClarify = null; ui.focusAfter = '#ask-q'; ui.render(); };

  ui.forms.ask = async (form) => {
    if (ui.askBusy) return;
    const q = form.elements.question.value.trim();
    const cfg = ui.store.settings();
    ui.askError = '';
    if (!cfg.geminiKey) { ui.askError = 'Add a Gemini key in Settings first, or open the demo question.'; ui.render(); return; }
    let question = q;
    if (ui.askClarify) {
      const d = form.elements.details ? form.elements.details.value.trim() : '';
      if (d.length < 3) { ui.askError = 'Add the missing detail, or edit the question itself.'; ui.focusAfter = '#ask-d'; ui.render(); return; }
      question = (ui.askClarify.original + ' ' + d).slice(0, 600);
    } else {
      const pc = MT.custom.precheck(q);
      if (pc.clarify) { ui.askClarify = { question: pc.question, original: q }; ui.focusAfter = '#ask-d'; ui.render(); return; }
    }
    ui.askBusy = true; ui.render();
    const r = await MT.ai.generateTrack({ apiKey: cfg.geminiKey }, question);
    ui.askBusy = false;
    if (!r.ok && r.clarify) { ui.askClarify = { question: r.error, original: question }; ui.drafts['ask-d'] = ''; ui.focusAfter = '#ask-d'; ui.render(); return; }
    if (!r.ok) { ui.askError = r.error; ui.focusAfter = '#ask-q'; ui.render(); return; }
    const id = ui.store.addCustomTrack({ question, spec: r.spec, source: 'gemini' });
    ui.askClarify = null; ui.drafts['ask-d'] = '';
    ui.drafts['ask-q'] = '';
    ui.go(ui.link('workspace', { track: id, problem: 'q' }));
  };

  ui.actions['ask-fixture'] = () => {
    const id = ui.store.addCustomTrack({ question: MT.custom.FIXTURE.question, spec: MT.custom.FIXTURE.spec, source: 'fixture' });
    ui.go(ui.link('workspace', { track: id, problem: 'q' }));
  };

  ui.actions['ask-delete'] = async (el) => {
    const ok = await ui.confirm({ title: 'Delete this question?', body: 'Its map, sessions and mastery estimates are removed from this profile.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    ui.store.removeCustomTrack(el.dataset.id);
    ui.toast('Question deleted.');
    ui.render();
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
