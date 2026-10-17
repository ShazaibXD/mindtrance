/* JEE Chemistry: pH of a very dilute strong acid or base. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const KW = 1e-14;
  const r2 = (v) => Math.round(v * 100) / 100;
  const fmtC = (c) => { const e = Math.floor(Math.log10(c)); return (c / Math.pow(10, e)).toFixed(0) + ' x 10^' + e; };
  const pHacid = (c) => -Math.log10((c + Math.sqrt(c * c + 4 * KW)) / 2);

  const concepts = [
    {
      id: 'log_ph', name: 'pH = -log[H+]', level: 1, prior: 0.70,
      desc: 'pH is the negative base-10 logarithm of the hydrogen ion concentration.', prereqs: [],
      lesson: {
        explain: 'pH = -log10[H+]. A concentration of 10^-n M has pH n. Smaller concentrations give larger pH.',
        why: 'Every pH answer ends with this conversion, so a sign or exponent error spoils the result.',
        misconception: 'Dropping the minus sign, or reading 10^-8 as 10^8.',
        example: { q: 'pH when [H+] = 10^-3 M.', a: 'pH = -log10(10^-3) = 3.' },
      },
      probe: { q: 'The hydrogen ion concentration is 1 x 10^-5 M. The pH is:', options: ['-5', '5', '9'], correct: 1 },
      practice: { q: '[H+] = 1 x 10^-9 M. The pH is:', options: ['9', '-9', '5'], correct: 0, feedback: 'pH = -log10(10^-9) = 9.' },
    },
    {
      id: 'kw', name: 'Ion product of water', level: 1, prior: 0.60,
      desc: 'Kw = [H+][OH-] = 1 x 10^-14 at 25 °C.', prereqs: [],
      lesson: {
        explain: 'Water always ionizes slightly. At 25 °C the product [H+][OH-] is fixed at 10^-14, so pure water has [H+] = 10^-7 M.',
        why: 'At acid concentrations near 10^-7 M the water’s own ions are no longer negligible.',
        misconception: 'Believing water contributes nothing once an acid is added.',
        example: { q: '[OH-] when [H+] = 10^-3 M.', a: '[OH-] = 10^-14 / 10^-3 = 10^-11 M.' },
      },
      probe: { q: 'In an aqueous solution at 25 °C, [H+] = 1 x 10^-4 M. [OH-] is:', options: ['1 x 10^-10 M', '1 x 10^-4 M', '1 x 10^10 M'], correct: 0 },
      practice: { q: 'Pure water at 25 °C has [H+] equal to:', options: ['10^-14 M', '10^-7 M', '1 M'], correct: 1, feedback: 'In pure water [H+] = [OH-] and the product is 10^-14, so each is 10^-7 M.' },
    },
    {
      id: 'quadratic', name: 'Solving a quadratic', level: 1, prior: 0.65,
      desc: 'x = (-b +/- sqrt(b^2 - 4ac)) / 2a, and picking the physically valid root.', prereqs: [],
      lesson: {
        explain: 'For a x^2 + b x + c = 0 use x = (-b +/- sqrt(b^2 - 4ac))/2a. Reject a root that is negative when the quantity is a concentration.',
        why: 'The exact [H+] in a dilute acid comes from a quadratic, not a one-step shortcut.',
        misconception: 'Keeping both roots, including the negative concentration.',
        example: { q: 'Solve x^2 - 5x + 6 = 0.', a: 'x = (5 +/- 1)/2, so x = 3 or x = 2.' },
      },
      probe: { q: 'x^2 - x - 6 = 0 has positive root:', options: ['2', '3', '6'], correct: 1 },
      practice: { q: 'x^2 - 4 = 0 has positive root:', options: ['4', '2', '16'], correct: 1, feedback: 'x^2 = 4 gives x = 2 for the positive root.' },
    },
    {
      id: 'ph_strong', name: 'pH of a strong acid', level: 2, prior: 0.75,
      desc: 'A strong monoprotic acid at ordinary concentration: [H+] equals the acid concentration.',
      prereqs: [['log_ph', 0.9, 'The final step is the pH from [H+].']],
      lesson: {
        explain: 'A strong acid ionizes completely, so [H+] = C. For 0.01 M HCl the pH is 2.',
        why: 'It is the standard case and gives the first approximation for dilute acids.',
        misconception: 'Believing the formula holds at any concentration.',
        example: { q: 'pH of 0.001 M HCl.', a: '[H+] = 10^-3 M, so pH = 3.' },
      },
      probe: { q: 'The pH of 0.01 M HCl is:', options: ['1', '2', '12'], correct: 1 },
      practice: { q: 'The pH of 1 x 10^-4 M HNO3 is:', options: ['10', '4', '-4'], correct: 1, feedback: '[H+] = 10^-4 M so pH = 4.' },
    },
    {
      id: 'total_h', name: 'Total [H+] with water ionization', level: 2, prior: 0.50,
      desc: 'When acid is very dilute, [H+] has contributions from the acid and from water.',
      prereqs: [
        ['kw', 0.85, 'Water’s contribution comes from Kw.'],
        ['quadratic', 0.7, 'The charge balance becomes a quadratic in [H+].'],
      ],
      lesson: {
        explain: 'Charge balance gives [H+] = C + [OH-] = C + Kw/[H+]. This is [H+]^2 - C[H+] - Kw = 0, so [H+] = (C + sqrt(C^2 + 4Kw))/2.',
        why: 'For C near 10^-7 M or lower, ignoring water gives answers that are plainly impossible.',
        misconception: 'Adding C and 10^-7 directly. The acid suppresses water ionization, so that overestimates [H+].',
        example: { q: '[H+] for C = 10^-7 M.', a: 'x = (10^-7 + sqrt(10^-14 + 4 x 10^-14))/2 = 1.62 x 10^-7 M, pH 6.79.' },
      },
      probe: { q: 'A 10^-8 M acid solution at 25 °C must have pH:', options: ['8', 'just below 7', 'above 8'], correct: 1 },
      practice: { q: 'For a very dilute strong acid the exact [H+] solves:', options: ['x = C', 'x^2 - C x - Kw = 0', 'x = Kw / C'], correct: 1, feedback: 'From charge balance x = C + Kw/x, which rearranges to x^2 - C x - Kw = 0.' },
    },
    {
      id: 'ph_dilute', name: 'pH of a very dilute acid', level: 3, prior: 0.50,
      desc: 'Combining charge balance, the quadratic and the logarithm for C near 10^-8 M.',
      prereqs: [
        ['total_h', 0.95, 'The exact [H+] must include water’s contribution.'],
        ['ph_strong', 0.7, 'It extends the strong-acid case below the usual validity range.'],
      ],
      lesson: {
        explain: 'Find [H+] from the quadratic, then take -log10. A real acid solution can never have pH above 7 at 25 °C.',
        why: 'It tests whether you notice when an approximation stops working.',
        misconception: 'Applying pH = -log C blindly, giving a basic pH for an acid.',
        example: { q: 'pH of 10^-7 M HCl.', a: '[H+] = 1.62 x 10^-7 M, pH = 6.79.' },
      },
      probe: { q: 'Adding any strong acid to pure water at 25 °C makes the pH:', options: ['greater than 7', 'less than 7', 'exactly 7'], correct: 1 },
      practice: { q: 'For 1 x 10^-7 M HCl at 25 °C the pH is closest to:', options: ['7.00', '6.79', '7.30'], correct: 1, feedback: '[H+] = 1.62 x 10^-7 M, so pH = 6.79.' },
    },
  ];

  const tol = { tolAbs: 0.01 };
  const unitless = { unit: '', exact: true };

  const problems = [{
    id: 'ph-dilute-hcl',
    title: 'pH of 10^-8 M hydrochloric acid',
    target: 'ph_dilute',
    difficulty: 'Trap',
    gen() {
      const ans = r2(pHacid(1e-8));
      return {
        statement: 'Calculate the pH of a 1 x 10^-8 M aqueous solution of HCl at 25 °C. Take Kw = 1 x 10^-14.',
        answer: Object.assign({ kind: 'number', value: ans, display: String(ans) }, unitless, tol),
        solution: ['HCl is a strong acid but C is comparable to water’s own 10^-7 M', '[H+] = C + Kw/[H+], so [H+]^2 - 10^-8 [H+] - 10^-14 = 0', '[H+] = 1.05 x 10^-7 M, pH = 6.98'],
        setup: [/Kw|10\^-14|1e-14/i, /quadratic|x\^2|\[H\+?\]\^2/i],
        unitSensitive: false,
        patterns: [
          { value: 8, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The result 8 is -log C with water ignored. An acid cannot give pH above 7.' },
          { value: 7, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The result 7 treats the acid as negligible next to water.' },
          { value: 6.96, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The result 6.96 comes from adding 10^-8 and 10^-7 directly instead of solving the charge balance.' },
          { value: -8, cat: 'PREREQUISITE_GAP', concept: 'log_ph', evidence: 'The result -8 is log[H+] without the minus sign.' },
          { value: 6, cat: 'CARELESS_SLIP', concept: null, evidence: 'The result 6 is what 10^-6 M would give: the exponent looks misread.' },
        ],
        keywords: [
          { re: /\[?H\+?\]?\s*=\s*(1\s*[x*×]\s*)?10\^?-?8\b[^+]*$/i, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The working sets [H+] = 10^-8 and never adds the water contribution.' },
        ],
      };
    },
  }];

  const verification = [
    {
      id: 'ph-verify-acid',
      title: 'Fresh dilute acid',
      gen(rng) {
        const c = rng.pick([2e-8, 3e-8, 5e-8, 8e-8]);
        const ans = r2(pHacid(c));
        return {
          statement: 'Find the pH of a ' + fmtC(c) + ' M solution of the strong acid HNO3 at 25 °C (Kw = 1 x 10^-14).',
          answer: Object.assign({ kind: 'number', value: ans, display: String(ans) }, unitless, tol),
          solution: ['[H+]^2 - C[H+] - Kw = 0', '[H+] = (C + sqrt(C^2 + 4Kw))/2', 'pH = ' + ans],
          setup: [], unitSensitive: false,
          patterns: [
            { value: r2(-Math.log10(c)), cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'pH = -log C ignores water, which gives an acid a pH above 7.' },
            { value: 7, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The acid was treated as negligible.' },
            { value: r2(-Math.log10(c + 1e-7)), cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'C and 10^-7 were added directly.' },
          ],
          keywords: [],
        };
      },
    },
    {
      id: 'ph-verify-base',
      title: 'Fresh dilute base',
      gen(rng) {
        const c = rng.pick([2e-8, 4e-8, 6e-8]);
        const pOH = pHacid(c);
        const ans = r2(14 - pOH);
        return {
          statement: 'A solution of NaOH has concentration ' + fmtC(c) + ' M at 25 °C. Find its pH. Take Kw = 1 x 10^-14.',
          answer: Object.assign({ kind: 'number', value: ans, display: String(ans) }, unitless, tol),
          solution: ['Charge balance for [OH-]: [OH-]^2 - C[OH-] - Kw = 0', 'pOH = ' + r2(pOH), 'pH = 14 - pOH = ' + ans],
          setup: [], unitSensitive: false,
          patterns: [
            { value: r2(14 + Math.log10(c)), cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'Water’s [OH-] was ignored, so the base seems to give a pH below 7.' },
            { value: 7, cat: 'PREREQUISITE_GAP', concept: 'total_h', evidence: 'The base was treated as negligible.' },
            { value: r2(-Math.log10(c)), cat: 'PREREQUISITE_GAP', concept: 'kw', evidence: 'The pOH was reported as the pH.' },
          ],
          keywords: [],
        };
      },
    },
  ];

  MT.data.register({
    id: 'jee-ph-dilute', domainId: 'jee-chemistry', exam: 'JEE Advanced', subject: 'Physical Chemistry', topic: 'Ionic equilibrium',
    blurb: 'When pH = -log C quietly stops working.',
    target: 'ph_dilute', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
