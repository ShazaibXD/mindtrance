/* Public landing page. Everything shown here describes what the prototype actually does. */
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

  function render() {
    const signedIn = !!ui.store.profile();
    const track = MT.data.track('eee-transformers');
    const domains = MT.data.domains.filter((d) => !d.dynamic).map((d) => {
      const ts = MT.data.tracksFor(d.id);
      return '<li class="domain"><div class="row between"><h3>' + esc(d.name) + '</h3><span class="badge">' + esc(d.exam) + '</span></div><p class="muted">' + esc(d.blurb) + '</p>'
        + (ts.length ? '<p class="faint small">Included: ' + ts.map((t) => esc(t.topic)).join(', ') + '</p>' : '<p class="faint small">Track pending</p>') + '</li>';
    }).join('');

    return '<header class="topnav"><div class="container row between">'
      + '<a class="brand" href="#/" aria-label="MINDTRACE home"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</a>'
      + '<nav class="row" aria-label="Main"><a class="navlink hide-sm" href="#/" data-scroll="how">How it works</a><a class="navlink hide-sm" href="#/" data-scroll="domains">Domains</a><a class="navlink hide-sm" href="#/" data-scroll="honest">What is real</a>'
      + '<button class="btn ghost sm" type="button" data-action="toggle-theme" aria-label="Toggle light or dark theme">' + ui.icon('sun', 16) + '</button>'
      + (signedIn ? '<a class="btn primary sm" href="#/app/dashboard">Open app</a>' : '<a class="btn sm" href="#/signin">Sign in</a><button class="btn primary sm" type="button" data-action="start-demo">Judge demo</button>')
      + '</nav></div></header>'
      + '<main id="main">'
      + '<section class="hero container"><div class="hero-copy">'
      + '<p class="eyebrow">AI-assisted learning diagnostics</p>'
      + '<h1 id="page-title" class="display">Find the gap.<br>Fix the foundation.</h1>'
      + '<p class="lead">When a student gets a problem wrong, MINDTRACE asks why. It separates a slip from a missing prerequisite, tests the suspected cause with a short probe, and only then teaches the concept that is actually missing.</p>'
      + '<div class="row"><button class="btn primary lg" type="button" data-action="start-demo">Try the judge demo</button><a class="btn lg" href="#/" data-scroll="how">See how it works</a></div>'
      + '<p class="faint small">Runs entirely in your browser. No account, no server, no API key needed.</p></div>'
      + '<figure class="hero-fig"><figcaption class="eyebrow">Example: a transformer numerical that went wrong</figcaption>'
      + MT.GraphView.html(track, illustration(track), { compact: true, key: 'landing', selected: 'turns_ratio' })
      + '<p class="faint small">Illustration with hand-set values. The student fails a probe on turns ratio, so the target problem is blocked until that concept is recovered and re-verified.</p></figure></section>'

      + '<section class="section container" aria-labelledby="h-slip"><h2 id="h-slip" class="h2">A wrong answer does not always mean a gap in the concept</h2>'
      + '<div class="cols3">'
      + '<article class="card"><span class="badge verify">Slip</span><h3>The method is right</h3><p class="muted">The setup is sound and a late arithmetic or copying step failed. MINDTRACE asks for a retry and does not lower mastery.</p></article>'
      + '<article class="card"><span class="badge verify">Unit error</span><h3>A prefix was missed</h3><p class="muted">The answer is off by a power of ten on a problem with units. One is a slip; a repeat triggers a probe on unit conversion.</p></article>'
      + '<article class="card"><span class="badge gap">Prerequisite gap</span><h3>The cause is upstream</h3><p class="muted">The error pattern points to a concept the problem depends on. A probe confirms or rejects it before anything is taught.</p></article>'
      + '</div></section>'

      + '<section id="how" class="section container" aria-labelledby="h-how"><h2 id="h-how" class="h2">How a diagnosis works</h2>'
      + '<ol class="flow">'
      + '<li><h3>Attempt</h3><p class="muted">Submit the final answer and your working. The answer is checked by deterministic parsing, never by a language model.</p></li>'
      + '<li><h3>Classify</h3><p class="muted">Known error signatures, power-of-ten and sign slips, and keywords in your working give a category with the evidence shown.</p></li>'
      + '<li><h3>Trace</h3><p class="muted">Candidate causes are ranked through the prerequisite graph by dependency strength and your mastery history, not by proximity alone.</p></li>'
      + '<li><h3>Probe</h3><p class="muted">A one-step question isolates the top suspect. Only a failed probe, with the Bayesian estimate below 0.45, makes it a confirmed gap.</p></li>'
      + '<li><h3>Recover</h3><p class="muted">A short lesson with the misconception named, one worked example and a practice question. Learning is only credited after the lesson.</p></li>'
      + '<li><h3>Verify</h3><p class="muted">A fresh problem with new numbers tests transfer. Passing raises mastery and unlocks the original problem.</p></li>'
      + '</ol></section>'

      + '<section id="domains" class="section container" aria-labelledby="h-dom"><h2 id="h-dom" class="h2">Examination domains</h2>'
      + '<p class="muted measure">Each domain holds knowledge tracks. A track is a prerequisite graph, practice problems and verification templates, defined as data so new ones can be added without touching the engine.</p>'
      + '<ul class="domains list-reset">' + domains + '</ul></section>'

      + '<section class="section container" aria-labelledby="h-feat"><h2 id="h-feat" class="h2">What is in the prototype</h2>'
      + '<ul class="featlist list-reset">'
      + '<li><strong>Knowledge gap map.</strong> Interactive graph with pan, zoom, dependency highlighting and a concept panel.</li>'
      + '<li><strong>Transparent mastery estimates.</strong> Bayesian Knowledge Tracing with observations and learning kept separate. Estimates are not calibrated measurements.</li>'
      + '<li><strong>Safe answer checking.</strong> Numbers, units and algebraic expressions are parsed without eval and compared numerically.</li>'
      + '<li><strong>Fresh verification.</strong> Generated problems with new numbers, graded the same way as the original.</li>'
      + '<li><strong>Progress analytics.</strong> Mastery over time, recovery success, repeated misconceptions and the concepts worth strengthening next.</li>'
      + '<li><strong>Ask anything.</strong> Type any question from any subject. With your own Gemini key, MINDTRACE builds a prerequisite map for it, judges your open-ended answer, asks a follow-up when it is unsure, and verifies learning with a fresh question. A scripted demo question works without a key.</li>'
      + '<li><strong>Judge demo.</strong> A guided run of the whole loop with the fixture clearly labelled.</li></ul></section>'

      + '<section id="honest" class="section container" aria-labelledby="h-real"><h2 id="h-real" class="h2">What is real and what is simulated</h2>'
      + '<div class="card elev stack"><p><strong>Diagnosis engine.</strong> Rule-based and deterministic by default. Each result is labelled with the engine that produced it. Optionally, you can add your own Gemini key in Settings so unrecognised answers get an AI reading; that path is schema-validated but has not been exercised against the live API in this build.</p>'
      + '<p><strong>Accounts and data.</strong> Profiles are local to this browser and have no password. There is no server or database yet. Real authentication and storage are on the roadmap.</p>'
      + '<p><strong>Content.</strong> ' + MT.data.tracks.length + ' hand-authored tracks with one to two original problems each, and generated verification variants. This is a seed for the format, not a full syllabus. Maps for questions you ask are written by Gemini, validated, and not reviewed by a person.</p></div></section>'

      + '<section class="section container cta"><h2 class="h2">See the whole loop in about three minutes</h2><p class="muted">The judge demo walks a wrong answer through diagnosis, a probe, recovery, a fresh verification problem and the updated graph.</p>'
      + '<div class="row"><button class="btn primary lg" type="button" data-action="start-demo">Start the judge demo</button><a class="btn lg" href="#/signin">Create a profile</a></div></section>'
      + '</main>'
      + '<footer class="footer"><div class="container row between"><span class="brand small"><span class="brand-mark" aria-hidden="true"></span>MINDTRACE</span><span class="faint small">Hackathon prototype. Mastery values are estimates, not grades.</span></div></footer>';
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
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
