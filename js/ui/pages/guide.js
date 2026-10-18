/* Guide: the loop in five steps, every status and word the app uses, and what is real. Static, no student data. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const ui = MT.ui;
  const { esc } = ui;

  const STEPS = [
    ['Attempt', 'You answer a problem and, if you can, show your working. The working is evidence too.'],
    ['Classify', 'MINDTRACE decides what kind of mistake it was: a slip, a unit slip, or a missing prerequisite.'],
    ['Ask, only if needed', 'If the evidence is thin, you get one short question. If your working already shows the cause, you get none.'],
    ['Recover', 'A short lesson, one worked example and a practice question aimed at the one concept that is missing.'],
    ['Verify', 'A fresh problem with new numbers checks that the fix transferred. Only then does the concept turn green.'],
  ];

  const TERMS = [
    ['Concept', 'One idea a problem depends on, for example "Turns, voltage and current ratios". A track is a map of concepts.'],
    ['Prerequisite', 'A concept that has to be understood first. The arrows on the map point from prerequisite to the concept that needs it.'],
    ['Slip', 'You knew the method but made a small error, such as arithmetic or a unit. A slip does not lower your mastery.'],
    ['Gap', 'A concept you are missing. A gap is "confirmed" only after a probe or your own working shows it.'],
    ['Probe', 'One short question that tells two possible causes apart. It is not a test and it is not graded.'],
    ['Evidence score', 'How sure MINDTRACE is about a diagnosis, from 0 to 100%. Below 45% it asks a question first. At 75% or more it is confirmed.'],
    ['Mastery estimate', 'A number from 0 to 1 for how likely you know a concept. It is an estimate, not a grade, and it fades if you stop practising.'],
    ['Fresh problem', 'A new problem on the same idea with different numbers, so you cannot pass by remembering the old answer.'],
    ['Spaced review', 'A quick re-check that comes back after a few days, because estimates drift without practice.'],
  ];

  function render() {
    const legend = Object.values(ui.STATUS).map((m) => '<li>' + ui.badge(m.cls, m.label, true) + '<span class="small muted">' + esc(m.help) + '</span></li>').join('');
    const steps = STEPS.map((s, i) => '<li class="gstep"><span class="gnum" aria-hidden="true">' + (i + 1) + '</span><div><h3 class="h3">' + esc(s[0]) + '</h3><p class="muted">' + esc(s[1]) + '</p></div></li>').join('');
    const terms = TERMS.map((t) => '<div class="gterm"><dt>' + esc(t[0]) + '</dt><dd class="muted">' + esc(t[1]) + '</dd></div>').join('');
    return '<div class="page-head"><div><p class="eyebrow">Guide</p><h1 id="page-title" class="h1">How MINDTRACE works</h1></div></div>'
      + '<section class="card" aria-labelledby="g-loop"><div class="card-head"><h2 id="g-loop">The loop</h2><span class="faint small">About three minutes, start to finish</span></div><p class="muted">A wrong answer does not always mean a gap in the concept. MINDTRACE finds out which it was before it teaches anything.</p><ol class="list-reset gsteps">' + steps + '</ol>'
      + '<div class="row"><a class="btn primary" href="' + ui.link('workspace', { track: 'eee-transformers', problem: 'tx-secondary-current' }) + '">Try it on a problem ' + ui.icon('arrow', 16) + '</a><a class="btn" href="' + ui.link('ask') + '">Or ask your own question</a></div></section>'
      + '<section class="card" aria-labelledby="g-col"><div class="card-head"><h2 id="g-col">What the colours on the map mean</h2></div><ul class="list-reset legend gleg">' + legend + '</ul><p class="small faint">Colour is never the only signal: every status also has a symbol and a text label.</p></section>'
      + '<section class="card" aria-labelledby="g-words"><div class="card-head"><h2 id="g-words">Words used in the app</h2></div><dl class="gterms">' + terms + '</dl></section>'
      + '<section class="card" aria-labelledby="g-real"><div class="card-head"><h2 id="g-real">What is real and what is not</h2></div><ul class="list-reset gplain">'
      + '<li><strong>Diagnosis is rule-based.</strong> Known wrong-answer patterns, a deterministic number and unit parser, and the prerequisite map. No AI is needed for it.</li>'
      + '<li><strong>AI is optional and labelled.</strong> With your own Gemini key, it can build a map from your question and judge open answers. Those results are marked as AI judgements and can be wrong.</li>'
      + '<li><strong>Your data stays in this browser.</strong> There is no account and no server. Settings has a button to delete it.</li>'
      + '<li><strong>Estimates are not grades.</strong> The model parameters are fixed and have not been calibrated on real students.</li></ul></section>';
  }

  ui.registerPage({ name: 'guide', title: 'How it works', nav: { label: 'How it works', icon: 'info', order: 5.5 }, render });
  if (typeof module !== 'undefined' && module.exports) module.exports = { render };
})(typeof window !== 'undefined' ? window : globalThis);
