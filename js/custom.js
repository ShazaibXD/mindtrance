/* Custom tracks built from a student's own question. A track is stored as a validated plain-data spec
 * and rebuilt into the same track shape the built-in content uses, so every page and the whole
 * diagnostic flow work on it unchanged. Includes a scripted demo fixture that needs no AI. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const ID_RE = /^[a-z][a-z0-9_]{1,31}$/;
  const EDGE_WEIGHT = { REQUIRED: 0.9, SUPPORTING: 0.5 };
  const QUESTION_TYPES = ['NUMERICAL_PROBLEM', 'MULTIPLE_CHOICE', 'CONCEPT_EXPLANATION', 'CODE_AND_DEBUGGING', 'PROOF_OR_DERIVATION', 'TEXT_COMPREHENSION', 'ESSAY_OR_WRITING', 'AMBIGUOUS_FRAGMENT'];

  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const isStr = (v) => typeof v === 'string' && clean(v, 5).length > 0;

  function mcq(raw, label, needFeedback) {
    if (!raw || typeof raw !== 'object') return { error: label + ' is missing.' };
    if (!isStr(raw.question)) return { error: label + ' has no question.' };
    if (!Array.isArray(raw.options) || raw.options.length !== 3 || !raw.options.every(isStr)) return { error: label + ' needs exactly 3 options.' };
    const options = raw.options.map((o) => clean(o, 160));
    if (new Set(options.map((o) => o.toLowerCase())).size !== 3) return { error: label + ' has duplicate options.' };
    if (!Number.isInteger(raw.correct_index) || raw.correct_index < 0 || raw.correct_index > 2) return { error: label + ' has an invalid correct option.' };
    const out = { question: clean(raw.question, 300), options, correct_index: raw.correct_index };
    if (needFeedback) out.feedback = isStr(raw.feedback) ? clean(raw.feedback, 240) : 'Review the lesson above and try again.';
    return { value: out };
  }

  /* Strict validation of a generated spec. Returns { ok, spec } or { ok:false, error }. */
  function validateSpec(raw) {
    const fail = (error) => ({ ok: false, error: 'The generated map was rejected: ' + error });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('wrong shape.');
    if (raw.clarification_needed === true || raw.question_type === 'AMBIGUOUS_FRAGMENT') {
      return { ok: false, clarify: true, error: clean(raw.clarification_question, 200) || 'Could you add a little more detail to the question?' };
    }
    for (const k of ['title', 'subject', 'exam', 'target_node']) if (!isStr(raw[k])) return fail('missing ' + k + '.');
    if (!Array.isArray(raw.nodes) || raw.nodes.length < 4 || raw.nodes.length > 6) return fail('it needs 4 to 6 concepts.');
    const ids = new Set();
    const nodes = [];
    for (const n of raw.nodes) {
      if (!n || typeof n !== 'object') return fail('a concept was malformed.');
      if (typeof n.id !== 'string' || !ID_RE.test(n.id)) return fail('a concept id was not valid.');
      if (ids.has(n.id)) return fail('duplicate concept id ' + n.id + '.');
      ids.add(n.id);
      if (!isStr(n.label) || !isStr(n.summary)) return fail(n.id + ' has no name or summary.');
      if (!Number.isInteger(n.level) || n.level < 1 || n.level > 3) return fail(n.id + ' has an invalid level.');
      if (typeof n.prior !== 'number' || !(n.prior >= 0.3 && n.prior <= 0.85)) return fail(n.id + ' has an invalid starting estimate.');
      const L = n.lesson;
      if (!L || !['explain', 'why', 'misconception', 'example_q', 'example_a'].every((k) => isStr(L[k]))) return fail(n.id + ' has an incomplete lesson.');
      const probe = mcq(n.probe, n.id + ' probe');
      if (probe.error) return fail(probe.error);
      const practice = mcq(n.practice, n.id + ' practice', true);
      if (practice.error) return fail(practice.error);
      if (!Array.isArray(n.verify) || n.verify.length < 1 || n.verify.length > 3) return fail(n.id + ' needs 1 to 3 verification questions.');
      const verify = [];
      for (const [i, v] of n.verify.entries()) {
        const r = mcq(v, n.id + ' verification ' + (i + 1));
        if (r.error) return fail(r.error);
        verify.push(r.value);
      }
      if (!Array.isArray(n.prereqs)) return fail(n.id + ' has no prerequisite list.');
      nodes.push({
        id: n.id, label: clean(n.label, 60), level: n.level, summary: clean(n.summary, 240), prior: n.prior,
        lesson: { explain: clean(L.explain, 500), why: clean(L.why, 400), misconception: clean(L.misconception, 400), example_q: clean(L.example_q, 300), example_a: clean(L.example_a, 400) },
        probe: probe.value, practice: practice.value, verify,
        prereqs: n.prereqs.map((p) => ({
          id: p && p.id, why: clean(p && p.why, 200),
          strength: p && p.strength === 'SUPPORTING' ? 'SUPPORTING' : 'REQUIRED',
          confidence: p && typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1 ? p.confidence : 0.8,
        })),
      });
    }
    const target = String(raw.target_node).trim();
    if (!ids.has(target)) return fail('the target concept is not one of the concepts.');
    const targets = nodes.filter((n) => n.level === 3);
    if (targets.length !== 1 || targets[0].id !== target) return fail('there must be exactly one level 3 target concept.');
    for (const n of nodes) {
      for (const p of n.prereqs) {
        if (typeof p.id !== 'string' || !ids.has(p.id)) return fail(n.id + ' depends on an unknown concept.');
        if (p.id === n.id) return fail(n.id + ' depends on itself.');
      }
    }
    const src = raw.analysis && typeof raw.analysis === 'object' ? raw.analysis : raw; // stored specs nest it, model output is flat
    const analysis = {
      question_type: QUESTION_TYPES.includes(src.question_type) ? src.question_type : 'CONCEPT_EXPLANATION',
      education_level: clean(src.education_level, 40) || 'Not stated',
      language: clean(src.language, 20) || 'en',
    };
    const spec = { title: clean(raw.title, 120), subject: clean(raw.subject, 60), exam: clean(raw.exam, 40), target_node: target, analysis, nodes };
    const problems = MT.graph.validate(buildTrack({ id: 'ask-validate', spec, question: 'validation', source: 'check' }));
    if (problems.length) return fail(problems[0] + '.');
    return { ok: true, spec };
  }

  /* Deterministic check for a question that cannot be answered as written (spec scenario: a calculation with no values). */
  function precheck(question) {
    const q = String(question || '').trim();
    const wantsCalc = /\b(calculate|compute|find|determine|work out)\b/i.test(q) || /\bwhat is the (value|current|voltage|area|volume|speed|velocity|force|resistance|power|mass|energy|pressure|temperature)\b/i.test(q);
    const conceptual = /\b(explain|why|how|describe|define|discuss|compare|difference|what is a|what are|essay|analy[sz]e|evaluate whether)\b/i.test(q);
    const hasNumbers = /\d/.test(q);
    const hasMath = /[=^+*\/]|\b(squared|cubed|sin|cos|tan|log|ln|integral|derivative|equation|function|expression)\b/i.test(q);
    const refsFigure = /\b(circuit|diagram|figure|graph|table|picture)\b/i.test(q);
    if (wantsCalc && !hasNumbers && !hasMath && !conceptual) {
      return { clarify: true, question: 'I can help with that. Could you share the values given in the problem (numbers and units)' + (refsFigure ? ', or describe what the diagram shows?' : '?') };
    }
    return { clarify: false };
  }

  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
  const makeId = (question) => 'ask-' + hash(String(question).trim().toLowerCase());

  function shorten(q) { const t = q.replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '...' : t; }

  /* Turn a stored entry into a full track. Pure: same input gives the same track. */
  function buildTrack(entry) {
    const { spec, question } = entry;
    const concepts = spec.nodes.map((n) => ({
      id: n.id, name: n.label, level: n.level, prior: n.prior, desc: n.summary,
      prereqs: n.prereqs.map((p) => [p.id, EDGE_WEIGHT[p.strength || 'REQUIRED'], p.why, p.confidence != null ? p.confidence : 0.8, p.strength || 'REQUIRED']),
      lesson: { explain: n.lesson.explain, why: n.lesson.why, misconception: n.lesson.misconception, example: { q: n.lesson.example_q, a: n.lesson.example_a } },
      probe: { q: n.probe.question, options: n.probe.options.slice(), correct: n.probe.correct_index },
      practice: { q: n.practice.question, options: n.practice.options.slice(), correct: n.practice.correct_index, feedback: n.practice.feedback },
    }));
    const verification = [];
    for (const n of spec.nodes) {
      n.verify.forEach((v, k) => verification.push({
        id: 'verify-' + n.id + '-' + k, title: 'Fresh question: ' + n.label, concept: n.id,
        gen: () => ({ statement: v.question, answer: { kind: 'choice', options: v.options.slice(), correct: v.correct_index, display: v.options[v.correct_index] }, solution: [], patterns: [], keywords: [], setup: [], unitSensitive: false }),
      }));
    }
    return {
      id: entry.id, domainId: 'ask', custom: true, source: entry.source || 'gemini', question,
      exam: spec.exam, subject: spec.subject, topic: spec.title, blurb: 'Built from your own question.',
      target: spec.target_node, analysis: spec.analysis || null, concepts, verification,
      problems: [{
        id: 'q', title: shorten(question), target: spec.target_node, difficulty: 'Open-ended',
        gen: () => ({ statement: question, answer: { kind: 'open', display: '' }, solution: [], patterns: [], keywords: [], setup: [], unitSensitive: false }),
      }],
    };
  }

  /* ---------- scripted demo fixture (no AI, labelled as such everywhere) ---------- */
  const Q = (question, options, correct_index, feedback) => (feedback ? { question, options, correct_index, feedback } : { question, options, correct_index });
  const FIXTURE_QUESTION = 'Explain how the Treaty of Versailles contributed to the outbreak of the Second World War.';
  const FIXTURE_SPEC = {
    title: 'Versailles and the road to WWII', subject: 'History', exam: 'Essay question', target_node: 'versailles_wwii',
    analysis: { question_type: 'ESSAY_OR_WRITING', education_level: 'Secondary school', language: 'en' },
    nodes: [
      {
        id: 'causal_reasoning', label: 'Causes versus triggers', level: 1, prior: 0.65, summary: 'Separating long-term conditions from the events that set a war off.',
        lesson: { explain: 'Long-term causes create the conditions for a conflict. A trigger is the event that sets it off. A strong explanation names both and links them.', why: 'The question asks how a 1919 treaty led to a 1939 war, which is a long-term cause argument.', misconception: 'Naming one event as "the cause" and ignoring the conditions that made it matter.', example_q: 'Is the assassination at Sarajevo a long-term cause or a trigger of WWI?', example_a: 'A trigger: it set off a crisis that alliances and rivalries had already prepared.' },
        probe: Q('The German invasion of Poland in 1939 is best described as a:', ['trigger', 'long-term cause', 'peace settlement'], 0),
        practice: Q('Which of these is a long-term cause of the First World War?', ['The assassination at Sarajevo', 'The system of rival alliances', 'The Treaty of Versailles'], 1, 'The alliance system built up over decades. The assassination was the trigger and Versailles came after the war.'),
        verify: [Q('Historians say the Great Depression "made extremism more attractive in Germany". This is an example of a:', ['contributing cause', 'treaty term', 'peace conference'], 0), Q('Which statement uses causal reasoning best?', ['The war began because of one shot.', 'Rivalries made war likely and the assassination set it off.', 'Wars have no real causes.'], 1)],
        prereqs: [],
      },
      {
        id: 'ww1_settlement', label: 'Terms of the Treaty', level: 1, prior: 0.6, summary: 'What the Treaty of Versailles actually required of Germany.',
        lesson: { explain: 'Signed in 1919, the treaty blamed Germany for the war (Article 231), demanded reparations, took territory, limited the army to 100,000 men and demilitarised the Rhineland.', why: 'You cannot argue about its effects without knowing precisely what it imposed.', misconception: 'Believing Germany negotiated the terms. Germany was given them to sign, which Germans called a diktat.', example_q: 'Which clause made Germany accept responsibility for the war?', example_a: 'Article 231, the war guilt clause.' },
        probe: Q('The clause that made Germany accept blame for the war is known as the:', ['war guilt clause', 'Locarno clause', 'League covenant'], 0),
        practice: Q('The treaty limited the German army to about:', ['100,000 men', '1,000,000 men', '10,000 men'], 0, 'The army was capped at 100,000 volunteers, with no tanks or air force.'),
        verify: [Q('Which area did the treaty demilitarise?', ['The Rhineland', 'The Ruhr', 'Bavaria'], 0), Q('Which of these did Germany lose under the treaty?', ['Alsace-Lorraine', 'Bavaria', 'Berlin'], 0)],
        prereqs: [],
      },
      {
        id: 'reparations', label: 'Reparations and the economy', level: 2, prior: 0.5, summary: 'How payment demands strained the German economy in the 1920s.',
        lesson: { explain: 'Germany was asked to pay 132 billion gold marks. When payments lagged, France and Belgium occupied the Ruhr in 1923 and hyperinflation wiped out savings.', why: 'Economic hardship is the link between the treaty terms and political anger.', misconception: 'Treating reparations as the only cause of the Depression. They strained the economy but the 1929 crash had other sources.', example_q: 'Why did France occupy the Ruhr in 1923?', example_a: 'To seize coal and goods after Germany missed reparations payments.' },
        probe: Q('In 1923 France and Belgium occupied which German region?', ['The Ruhr', 'The Rhineland coast', 'Silesia'], 0),
        practice: Q('The 1923 hyperinflation was most directly linked to:', ['printing money to cover debts and strikes in the Ruhr', 'the limit on army size', 'the loss of colonies'], 0, 'The government printed money to pay striking workers and its debts, destroying the currency.'),
        verify: [Q('What did the 1924 Dawes Plan do?', ['Restructured payments and brought in US loans', 'Cancelled all reparations', 'Doubled reparations'], 0), Q('Why did reparations damage the reputation of the Weimar government?', ['Many Germans blamed it for accepting the treaty', 'It refused to pay anything', 'It was paid by Britain'], 0)],
        prereqs: [{ id: 'ww1_settlement', why: 'Reparations were one of the treaty\'s terms.' }],
      },
      {
        id: 'resentment', label: 'Resentment and extremist politics', level: 2, prior: 0.5, summary: 'How grievances over the treaty fed support for extremist parties.',
        lesson: { explain: 'Many Germans saw the treaty as a humiliation. The "stab in the back" myth blamed politicians for defeat, and the Nazis promised to overturn Versailles. The 1929 Depression made that message more powerful.', why: 'This is the political mechanism that turns economic and national grievance into support for aggression.', misconception: 'Saying the treaty alone made war inevitable. It created grievances that others exploited.', example_q: 'What was the "stab in the back" myth?', example_a: 'The claim that Germany was betrayed at home by politicians rather than defeated on the battlefield.' },
        probe: Q('The "stab in the back" myth claimed that:', ['Germany was betrayed at home rather than beaten in the field', 'Germany had won the war', 'The USA had attacked Germany'], 0),
        practice: Q('Why did the Nazis gain from the treaty in the early 1930s?', ['They promised to overturn it and restore national pride', 'They had signed it', 'They wanted to pay reparations in full'], 0, 'The treaty gave them a ready grievance, and the Depression gave it an audience.'),
        verify: [Q('Which best explains why the Depression boosted extremist parties?', ['Hardship made radical promises more attractive', 'It made the treaty more popular', 'It ended unemployment'], 0), Q('Weimar politicians were unpopular partly because they were:', ['associated with signing the treaty', 'in favour of rearmament', 'members of the Nazi party'], 0)],
        prereqs: [{ id: 'ww1_settlement', why: 'The grievances are about specific treaty terms.' }, { id: 'reparations', why: 'Economic hardship intensified the anger. Historians weigh this link differently, so it is a supporting foundation rather than a strict step.', strength: 'SUPPORTING', confidence: 0.55 }],
      },
      {
        id: 'versailles_wwii', label: 'Versailles and the origins of WWII', level: 3, prior: 0.45, summary: 'Building a balanced causal argument from the treaty to 1939.',
        lesson: { explain: 'A strong answer chains treaty terms to economic strain, to resentment, to the success of extremists and to aggression, then weighs other factors such as the Depression, appeasement and the weakness of the League.', why: 'This is what the essay question rewards: a linked, weighed argument, not a list of facts.', misconception: 'Claiming the treaty directly caused the war in 1939 and ignoring everything in between.', example_q: 'Give a one-sentence balanced claim.', example_a: 'The treaty created grievances that the Nazis exploited, but the Depression and appeasement made war possible.' },
        probe: Q('Which is the strongest claim about Versailles and WWII?', ['It created grievances that extremists exploited alongside other factors', 'It directly caused war in 1939', 'It had no effect on later events'], 0),
        practice: Q('Which sentence best weighs the causes?', ['The treaty helped cause war, but the Depression and appeasement were also decisive.', 'Only the treaty mattered.', 'The treaty was irrelevant.'], 0, 'A balanced claim credits the treaty and still weighs other causes.'),
        verify: [Q('Which essay opening makes a linked argument?', ['Harsh terms strained the economy, which fed resentment that extremists used.', 'The treaty was signed in 1919.', 'Many things happened in the 1930s.'], 0), Q('Why is "the treaty caused WWII" too simple?', ['It ignores the Depression, appeasement and the choices of leaders', 'Because the treaty had no terms', 'Because Germany won the first war'], 0)],
        prereqs: [{ id: 'resentment', why: 'The political mechanism links the treaty to Nazi success.' }, { id: 'reparations', why: 'Economic strain is the first link in the chain.' }, { id: 'causal_reasoning', why: 'The answer must separate long-term causes from triggers.' }],
      },
    ],
  };

  /* Scripted rubric for the fixture question. Keyword rules, not AI. Labelled "demo rubric" in the UI. */
  function fixtureJudge(answer) {
    const t = String(answer || '').toLowerCase();
    const has = (...w) => w.some((x) => t.includes(x));
    const engine = 'demo-rubric';
    const label = 'Demo rubric (keyword rules, not AI): ';
    if (has('reparation') && has('resent', 'humiliat', 'nazi', 'hitler', 'nationalis', 'extrem', 'depression', 'inflation')) {
      return { engine, matchedBy: 'rubric', isCorrect: true, category: 'CORRECT_UNDERSTANDING', confidence: 0.8, hintConcept: null, evidence: [label + 'your answer links reparations to resentment or extremist politics.'] };
    }
    if (has('reparation', 'war guilt', 'article 231', 'ruhr')) {
      return { engine, matchedBy: 'rubric', isCorrect: false, category: 'PREREQUISITE_GAP', confidence: 0.55, hintConcept: 'reparations', evidence: [label + 'your answer mentions the terms but does not connect them to economic collapse and political anger.'] };
    }
    if (has('treaty', 'versailles', 'germany', 'war')) {
      return { engine, matchedBy: 'rubric', isCorrect: false, category: 'PREREQUISITE_GAP', confidence: 0.4, hintConcept: 'ww1_settlement', evidence: [label + 'your answer names the treaty but not what it required of Germany, so the diagnosis is uncertain.'] };
    }
    return { engine, matchedBy: 'rubric', isCorrect: false, category: 'PREREQUISITE_GAP', confidence: 0.25, hintConcept: 'causal_reasoning', evidence: [label + 'the answer does not yet make a causal claim, so it is not clear which concept is missing.'] };
  }

  MT.custom = { precheck, QUESTION_TYPES, validateSpec, buildTrack, makeId, shorten, FIXTURE: { question: FIXTURE_QUESTION, spec: FIXTURE_SPEC, source: 'fixture' }, fixtureJudge };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.custom;
})(typeof window !== 'undefined' ? window : globalThis);
