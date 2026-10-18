/* Public landing page. Every number and claim here is computed from, or describes, what the prototype actually does. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;

  /* A hand-set illustration of one diagnosis outcome, clearly labelled as such on the page. */
  function illustration(track) {
    const set = { ohms_law: ['MASTERED', 0.86], unit_conv: ['MASTERED', 0.84], faraday: ['NEEDS_VERIFICATION', 0.7], alg_rearrange: ['SUSPECTED_GAP', 0.6], turns_ratio: ['CONFIRMED_GAP', 0.13], ideal_tx: ['BLOCKED', 0.5] };
    const out = {};
    for (const c of track.concepts) out[c.id] = { p: set[c.id][1], status: set[c.id][0], obs: 0, fails: 0 };
    return out;
  }

  /* The two evidence scores in the explainer come from the real engine, not from invented numbers. */
  function evidenceExamples() {
    const track = MT.data.track('eee-transformers');
    const problem = MT.data.instantiate(track.problems[0], 1);
    const bare = MT.diagnose.diagnose(track, problem, '200 A', '', {});
    const shown = MT.diagnose.diagnose(track, problem, '200 A', 'V2 = V1 x N1/N2 = 240 x 10 = 2400 V', {});
    return { bare: bare.evidenceScore, shown: shown.evidenceScore };
  }

  function render() {
    const signedIn = !!ui.store.profile();
    const track = MT.data.track('eee-transformers');
    const builtIn = MT.data.tracks.filter((t) => !t.custom);
    const domains = MT.data.domains.filter((d) => !d.dynamic);
    const ev = evidenceExamples();
    const sum = (f) => builtIn.reduce((n, t) => n + f(t), 0);
    const facts = [[builtIn.length, 'knowledge tracks'], [sum((t) => t.concepts.length), 'concepts in the graphs'], [sum((t) => t.problems.length), 'original problems'], [sum((t) => t.verification.length), 'fresh-question generators']]
      .map(([n, t]) => '<div class="fact"><span class="n" data-count="' + n + '">' + n + '</span><span class="t">' + t + '</span></div>').join('');
    const marquee = domains.map((d) => '<span class="marquee-item">' + esc(d.name) + '<small>' + esc(d.exam) + '</small></span>').join('');
    const domainCards = domains.map((d) => {
      const ts = MT.data.tracksFor(d.id);
      return '<li class="domain"><div class="row between"><h3>' + esc(d.name) + '</h3><span class="badge">' + esc(d.exam) + '</span></div><p class="muted">' + esc(d.blurb) + '</p><p class="faint small">' + (ts.length ? 'Included: ' + ts.map((t) => esc(t.topic)).join(', ') : 'Track pending') + '</p></li>';
    }).join('');
    const modes = MT.flow.MODES.map((m) => '<div class="mode"><strong>' + esc(m.label) + '</strong><span>' + esc(m.hint) + '</span></div>').join('');
    const steps = [
      ['Attempt', 'Type the final answer and, if you can, your working. Numbers, units and algebra are checked by a deterministic parser. A model never decides whether a number is right.'],
      ['Classify', 'Known wrong-answer patterns, power-of-ten and sign slips, and the steps in your working point to one of eleven outcomes, with the evidence quoted back to you.'],
      ['Trace', 'Candidate causes are ranked through the prerequisite graph by dependency strength and by what you have already shown, not by whichever concept happens to be nearest.'],
      ['Ask only if needed', 'If the evidence is thin, one short question separates the likely causes. If your working already shows the error, no question is asked. Never more than two.'],
      ['Recover', 'A short lesson that names the misconception, one worked example and a practice question. Learning is credited once, after the lesson.'],
      ['Verify', 'A fresh problem with new numbers tests transfer. Pass it and the original problem unlocks, the graph updates, and a spaced review is booked.'],
    ].map(([t, p], i, all) => '<div class="tl-step' + (i === all.length - 1 ? ' tl-last' : '') + '"><span class="tl-num">' + String(i + 1).padStart(2, '0') + '</span><h3>' + t + '</h3><p>' + p + '</p></div>').join('');

    return '<div class="landing">'
      + '<header class="topnav"><div class="container row between">'
      + '<a class="brand" href="#/" aria-label="MINDTRACE home"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</a>'
      + '<nav class="row" aria-label="Main"><a class="navlink hide-sm" href="#/" data-scroll="how">How it works</a><a class="navlink hide-sm" href="#/" data-scroll="evidence">Evidence</a><a class="navlink hide-sm" href="#/" data-scroll="domains">Domains</a><a class="navlink hide-sm" href="#/" data-scroll="honest">What is real</a>'
      + '<button class="btn ghost sm" type="button" data-action="toggle-theme" aria-label="Toggle light or dark theme">' + ui.icon('sun', 16) + '</button>'
      + (signedIn ? '<a class="btn primary sm" href="#/app/dashboard">Open app</a>' : '<a class="btn sm hide-sm" href="#/signin">Sign in</a><button class="btn primary sm" type="button" data-action="start-demo">Judge demo</button>')
      + '</nav></div></header>'
      + '<main id="main">'

      + '<section class="hero"><div class="hero-bg" data-vanta aria-hidden="true"></div><div class="hero-grid">'
      + '<h1 id="page-title" class="display hero-title" data-split>Find the gap.<br>Fix the foundation.</h1>'
      + '<div class="hero-copy">'
      + '<p class="lead" data-reveal data-delay="0.35">When a student gets a problem wrong, MINDTRACE finds out why. It tells a slip from a missing prerequisite, asks one short question when the evidence is thin, teaches only what is missing, and checks that it stuck with a fresh problem.</p>'
      + '<div class="cta-row" data-reveal data-delay="0.5"><button class="btn primary lg" type="button" data-action="start-demo" data-magnet>Try the judge demo</button><a class="btn lg" href="#/" data-scroll="how" data-magnet>See how it works</a></div>'
      + '<p class="hero-note" data-reveal data-delay="0.6">Runs in your browser. No account, and no API key for the demo.</p></div>'
      + '<figure class="hero-fig" data-reveal data-delay="0.3"><figcaption>One diagnosed transformer problem</figcaption>'
      + MT.GraphView.html(track, illustration(track), { compact: true, key: 'landing', selected: 'turns_ratio' })
      + '<figcaption>Illustration with hand-set values. The turns-ratio probe was missed, so the target problem is blocked until that concept is recovered and re-verified.</figcaption></figure></div></section>'

      + '<div class="marquee" data-marquee aria-label="Examination domains"><div class="marquee-track">' + marquee + '</div></div>'

      + '<section class="section container" aria-labelledby="h-slip"><div class="section-head"><h2 id="h-slip" class="section-title" data-split>A wrong answer does not always mean a gap in the concept</h2></div>'
      + '<div class="cols3" data-stagger>'
      + '<article class="card"><span class="badge verify">Slip</span><h3>The method is right</h3><p class="muted">The setup is sound and a late arithmetic or copying step went wrong. MINDTRACE asks for another try and does not lower mastery.</p></article>'
      + '<article class="card"><span class="badge verify">Unit or reading slip</span><h3>A prefix or a phrase</h3><p class="muted">The answer is off by a power of ten, or answers a slightly different question. One is a slip. A repeat triggers a quick check on unit conversion.</p></article>'
      + '<article class="card"><span class="badge gap">Prerequisite gap</span><h3>The cause is upstream</h3><p class="muted">The error pattern points at a concept the problem depends on. It is confirmed by evidence before anything is taught.</p></article>'
      + '</div></section>'

      + '<section id="how" class="section container" aria-labelledby="h-how"><div class="section-head"><h2 id="h-how" class="section-title" data-split>How a diagnosis works</h2></div>'
      + '<div class="timeline" data-timeline><div class="tl-rail"><div class="tl-fill"></div></div>' + steps + '</div></section>'

      + '<section id="evidence" class="section container" aria-labelledby="h-ev"><div class="section-head"><h2 id="h-ev" class="section-title" data-split>Evidence decides what happens next</h2>'
      + '<p class="section-lede" data-reveal>Every diagnosis carries a score built from weighted evidence. A final answer alone counts for little. A step in your working that shows the error counts for a lot. The same wrong answer, scored by the real engine:</p></div>'
      + '<div class="gauges" data-reveal>'
      + '<div class="gauge-row"><div class="gauge-top"><strong>Final answer only</strong><span class="mono">' + ui.pct(ev.bare) + '%</span></div><div class="gauge-track"><span class="gauge-fill lo" data-gauge style="width:' + ui.pct(ev.bare) + '%"></span><i class="gauge-mark" style="left:45%"><b>45</b></i><i class="gauge-mark" style="left:75%"><b>75</b></i></div></div>'
      + '<div class="gauge-row"><div class="gauge-top"><strong>Final answer plus the working that shows the step</strong><span class="mono">' + ui.pct(ev.shown) + '%</span></div><div class="gauge-track"><span class="gauge-fill hi" data-gauge style="width:' + ui.pct(ev.shown) + '%"></span><i class="gauge-mark" style="left:45%"><b>45</b></i><i class="gauge-mark" style="left:75%"><b>75</b></i></div></div></div>'
      + '<div class="tiers" data-stagger>'
      + '<article class="tier"><span class="range">below 45%</span><h3>Ask first</h3><p>Not enough to name a cause. One short question separates the likely explanations before anything is taught.</p></article>'
      + '<article class="tier"><span class="range">45% to 75%</span><h3>Check the hypothesis</h3><p>A working hypothesis is shared openly and tested with a quick check, so it is confirmed or ruled out.</p></article>'
      + '<article class="tier"><span class="range">75% or more</span><h3>Confirm and teach</h3><p>Your own working shows the cause, so no extra question is asked. Two questions without a cause lead to a worked solution and a review.</p></article>'
      + '</div></section>'

      + '<section class="section container" aria-labelledby="h-modes"><div class="section-head"><h2 id="h-modes" class="section-title" data-split>You choose how to be helped</h2><p class="section-lede" data-reveal>Nobody is trapped in questions. Ask for a hint or an explanation and you get one, with no penalty.</p></div><div class="modes" data-stagger>' + modes + '</div></section>'

      + '<section class="section container" aria-label="What is in the prototype"><div class="facts" data-reveal>' + facts + '</div></section>'

      + '<section id="domains" class="section container" aria-labelledby="h-dom"><div class="section-head"><h2 id="h-dom" class="section-title" data-split>Examination domains</h2><p class="section-lede" data-reveal>A track is a prerequisite graph, practice problems and fresh-question generators, written as data. Or ask your own question from any subject.</p></div><ul class="domains list-reset" data-stagger>' + domainCards + '</ul></section>'

      + '<section id="honest" class="section container" aria-labelledby="h-real"><div class="section-head"><h2 id="h-real" class="section-title" data-split>What is real and what is not</h2></div><div class="real" data-reveal>'
      + '<div><h3>Diagnosis</h3><p>Rule-based and deterministic by default, labelled with the engine that produced it. Optionally, with your own Gemini key, unrecognised answers and your own questions get an AI reading. That path is validated and tested with mocked replies, and has not been run against the live API.</p></div>'
      + '<div><h3>Accounts and data</h3><p>Profiles live in this browser and have no password. There is no server or database yet, so clearing site data deletes your progress.</p></div>'
      + '<div><h3>Content</h3><p>' + builtIn.length + ' hand-authored tracks. Maps built from questions you ask are written by a model, validated for structure, and not reviewed by a person.</p></div>'
      + '</div></section>'

      + '<section class="section container cta"><h2 class="section-title" data-split>See the whole loop in about three minutes</h2><p class="section-lede" data-reveal>A wrong answer, a follow-up question, recovery, a fresh problem and the updated graph.</p>'
      + '<div class="cta-row" data-reveal><button class="btn primary lg" type="button" data-action="start-demo" data-magnet>Start the judge demo</button><a class="btn lg" href="#/signin" data-magnet>Create a profile</a></div></section>'
      + '</main>'
      + '<footer class="footer"><div class="container"><div class="footer-row"><span class="brand small"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</span><span class="faint small">Hackathon prototype. Mastery values are estimates, not grades.</span></div></div><div class="wordmark" aria-hidden="true">MINDTRACE</div></footer></div>';
  }

  ui.registerPage({
    name: 'landing', title: '', shell: false, protected: false, render,
    mount: (root) => root.querySelectorAll('[data-gv-root]').forEach((el) => MT.GraphView.mount(el, { interactive: false })),
  });
  ui.actions['start-demo'] = () => ui.startDemo();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(a.dataset.scroll);
    if (!el) return;
    if (ui.motion && ui.motion.enabled()) ui.scrollTo(el.getBoundingClientRect().top + window.scrollY - 70, false);
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
