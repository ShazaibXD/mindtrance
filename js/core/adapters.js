/* Subject adapters (spec section 7). Each adapter says how a domain is decomposed, which deterministic checks
 * exist for it HERE (honestly marked), how mastery is estimated, and how recovery is built.
 * Only math and units have real deterministic verifiers in the browser. The others are guidance for the model. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const BLOCKS = {
    gap: ['validate what is right', 'core concept', 'analogy or visual', 'misconception contrast', 'guided micro step'],
    procedural: ['show the exact step beside the corrected step', 'one-step procedural check'],
    slip: ['point out the discrepancy', 'allow immediate re-submission'],
  };

  const A = (id, name, match, extra) => Object.assign({ id, name, match }, extra);
  const ADAPTERS = [
    A('math', 'Mathematics', /\b(math|algebra|calculus|geometry|trigonometr|statistic|arithmetic|derivative|integral|equation)/i, {
      verifiers: [{ name: 'Algebraic equivalence by numeric sampling', available: true }, { name: 'Unit and tolerance check', available: true }],
      guidelines: 'Break into algebraic skills and theorem conditions; watch sign errors and step order; probe with a simpler isolated expression.',
      probe: 'Can you isolate x in this simpler expression before substituting?', verification: 'Isomorphic problem with different coefficients and signs.',
    }),
    A('physics', 'Physics', /\b(physics|mechanic|electric|circuit|transformer|thermodynam|optics|kinematic|dynamics|magnet)/i, {
      verifiers: [{ name: 'Unit parser and conversion', available: true }, { name: 'Dimensional analysis library', available: false }],
      guidelines: 'Separate the governing law, vector or sign conventions, and unit handling; probe which quantity is conserved and why.',
      probe: 'Which quantity stays the same during this process, and why?', verification: 'A modified scenario that needs the same governing law.',
    }),
    A('chemistry', 'Chemistry', /\b(chemi|stoichiometr|molar|acid|base|equilibri|organic|oxidation|reaction)/i, {
      verifiers: [{ name: 'Equation balancer and molar mass checker', available: false }],
      guidelines: 'Track oxidation states, mole ratios, limiting reagents and equilibrium shifts; explain at the particle level.',
      probe: 'What is the oxidation state of the central atom before and after?', verification: 'Predict the product or limiting reagent for a parallel reaction.',
    }),
    A('biology', 'Biology', /\b(biolog|genetic|cell|enzyme|ecolog|physiolog|evolution|respiration)/i, {
      verifiers: [{ name: 'Process order and terminology check', available: false }],
      guidelines: 'Focus on process order, structure and function links, and the direction of feedback loops; contrast common misconceptions.',
      probe: 'If this enzyme is blocked, does the product build up or run out?', verification: 'A perturbation: what happens to the pathway if this changes?',
    }),
    A('programming', 'Programming', /\b(program|code|coding|algorithm|python|java|javascript|software|debug|data structure)/i, {
      verifiers: [{ name: 'Static syntax check and tests in an isolated sandbox', available: false, note: 'Not available in the browser: code is never executed here.' }],
      guidelines: 'Look for off-by-one bounds, missing base cases, mutability and complexity; use a dry-run trace table.',
      probe: 'What value does the loop variable hold on the last iteration when n = 1?', verification: 'Fix or write a function for a related boundary condition.',
    }),
    A('language', 'Languages and grammar', /\b(grammar|language|translation|vocabular|syntax|verb|tense|sentence)/i, {
      verifiers: [{ name: 'Morphological and part-of-speech rules', available: false }],
      guidelines: 'Check agreement, tense, case and idiom; contrast a correct and an incorrect pattern; keep the register simple.',
      probe: 'Which word is the main subject performing the action?', verification: 'Construct or correct a new sentence with the same rule.',
    }),
    A('humanities', 'Humanities and history', /\b(histor|humanit|politic|geograph|civics|philosoph|ethic|sociolog|literature)/i, {
      verifiers: [{ name: 'Chronology and named-entity checks', available: false }],
      guidelines: 'Watch single-cause reductionism, chronology and unsupported claims; separate long-term causes from triggers; weigh several factors.',
      probe: 'Was this factor an immediate trigger or a long-term tension?', verification: 'Evaluate a short source or compare two causes.', rubricOnly: true,
    }),
    A('commerce', 'Commerce and economics', /\b(econom|commerce|account|finance|business|demand|supply|market|ledger)/i, {
      verifiers: [{ name: 'Accounting identity and elasticity calculators', available: false }],
      guidelines: 'Check debit and credit direction, shifts versus movements along a curve, and ceteris paribus.',
      probe: 'Does a change in income shift the demand curve or move along it?', verification: 'Classify a new transaction or predict the shift in equilibrium.',
    }),
    A('writing', 'Writing and communication', /\b(writing|essay|composition|communicat|argument|rhetoric|paragraph)/i, {
      verifiers: [{ name: 'Readability and structure metrics', available: false }],
      guidelines: 'Judge thesis clarity, claim-evidence-reasoning alignment, cohesion and tone against a rubric.',
      probe: 'Which sentence states your main claim, and how does the quote support it?', verification: 'Revise a weak paragraph against the rubric.', rubricOnly: true,
    }),
  ];
  const GENERAL = A('general', 'General', /.^/, { verifiers: [], guidelines: 'Decompose into the smallest prerequisite skills and concepts that the question needs.', probe: 'A one-step question on the suspected concept.', verification: 'A fresh question on the same concept in a new setting.' });

  /* Pick the adapter from whatever subject words are available. */
  function forSubject(...texts) {
    const hay = texts.filter(Boolean).join(' ');
    return ADAPTERS.find((a) => a.match.test(hay)) || GENERAL;
  }

  /* Track A (BKT) for objective items, Track B (rubric) for open-ended work (spec 11). */
  const RUBRIC_TYPES = ['ESSAY_OR_WRITING', 'CONCEPT_EXPLANATION', 'TEXT_COMPREHENSION', 'PROOF_OR_DERIVATION'];
  function estimatorFor(adapter, questionType) {
    if (adapter && adapter.rubricOnly) return 'RUBRIC_BETA';
    return RUBRIC_TYPES.includes(questionType) ? 'RUBRIC_BETA' : 'BKT_DISCRETE';
  }

  function recoveryStrategy(outcomeKind, adapter) {
    const blocks = outcomeKind === 'slip' ? BLOCKS.slip : outcomeKind === 'procedural' ? BLOCKS.procedural : BLOCKS.gap;
    return { blocks, probe: adapter && adapter.probe, verification: adapter && adapter.verification };
  }

  /* One compact line per domain for the map-builder prompt. */
  const promptGuidance = () => ADAPTERS.map((a) => a.name + ': ' + a.guidelines).join(' ');

  MT.adapters = { ADAPTERS, GENERAL, BLOCKS, forSubject, estimatorFor, recoveryStrategy, promptGuidance, RUBRIC_TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.adapters;
})(typeof window !== 'undefined' ? window : globalThis);
