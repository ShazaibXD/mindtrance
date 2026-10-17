/* JEE Mathematics: differentiating composite functions. Answers are expressions in x. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const concepts = [
    {
      id: 'power_rule', name: 'Power rule', level: 1, prior: 0.80,
      desc: 'd/dx x^n = n x^(n-1).', prereqs: [],
      lesson: {
        explain: 'Bring the exponent down as a multiplier and reduce the exponent by one. Constants multiply through.',
        why: 'The inner function 3x^2 + 1 has to be differentiated before the chain rule can finish.',
        misconception: 'Forgetting the exponent multiplier, so d/dx (3x^2) becomes 3x.',
        example: { q: 'Differentiate 5x^3.', a: '5 x 3 x^2 = 15x^2.' },
      },
      probe: { q: 'The derivative of 3x^2 is:', options: ['3x', '6x', '6x^2'], correct: 1 },
      practice: { q: 'The derivative of 4x^3 is:', options: ['12x^2', '4x^2', '12x^3'], correct: 0, feedback: '4 x 3 x^(3-1) = 12x^2.' },
    },
    {
      id: 'trig_deriv', name: 'Derivatives of sin and cos', level: 1, prior: 0.70,
      desc: 'd/dx sin x = cos x and d/dx cos x = -sin x.', prereqs: [],
      lesson: {
        explain: 'The derivative of sin is cos with no sign change. The derivative of cos is minus sin. The minus sign belongs to cos only.',
        why: 'The outer function in the problem is sin, and sign errors here are the most common slip.',
        misconception: 'Giving every trig derivative a minus sign, or letting sin differentiate to sin.',
        example: { q: 'Differentiate cos x.', a: '-sin x.' },
      },
      probe: { q: 'The derivative of sin x is:', options: ['-cos x', 'cos x', 'sin x'], correct: 1 },
      practice: { q: 'The derivative of cos x is:', options: ['sin x', '-sin x', '-cos x'], correct: 1, feedback: 'd/dx cos x = -sin x.' },
    },
    {
      id: 'composite_fn', name: 'Recognising composite functions', level: 1, prior: 0.60,
      desc: 'Seeing f(g(x)) as an outer function applied to an inner one.', prereqs: [],
      lesson: {
        explain: 'In sin(3x^2 + 1) the outer function is sin and the inner function is 3x^2 + 1. Ask what is done last when evaluating.',
        why: 'You cannot apply the chain rule until you can name the inner and outer parts.',
        misconception: 'Seeing sin(3x^2 + 1) as sin times something instead of sin of something.',
        example: { q: 'Name the inner function of cos(x^3).', a: 'Inner is x^3, outer is cos.' },
      },
      probe: { q: 'In sin(5x + 2) the inner function is:', options: ['sin', '5x + 2', '5x'], correct: 1 },
      practice: { q: 'In (2x + 1)^4 the outer function is:', options: ['2x + 1', 'raise to the 4th power', '2x'], correct: 1, feedback: 'Last operation is raising to the 4th power, so that is the outer function.' },
    },
    {
      id: 'chain_rule', name: 'Chain rule', level: 2, prior: 0.55,
      desc: 'd/dx f(g(x)) = f\'(g(x)) g\'(x).',
      prereqs: [
        ['composite_fn', 0.9, 'You must identify the inner function g(x) first.'],
        ['power_rule', 0.5, 'The inner derivative g\'(x) is often a power-rule calculation.'],
      ],
      lesson: {
        explain: 'Differentiate the outer function, keep the inner function unchanged inside it, then multiply by the derivative of the inner function.',
        why: 'It is the step that most often gets dropped in composite derivatives.',
        misconception: 'Stopping after the outer derivative and forgetting the factor g\'(x).',
        example: { q: 'Differentiate sin(2x).', a: 'cos(2x) x 2 = 2cos(2x).' },
      },
      probe: { q: 'The derivative of sin(2x) is:', options: ['cos(2x)', '2cos(2x)', '-2cos(2x)'], correct: 1 },
      practice: { q: 'The derivative of (x^2 + 1)^3 is:', options: ['3(x^2 + 1)^2', '6x(x^2 + 1)^2', '3(2x)^2'], correct: 1, feedback: 'Outer: 3(x^2+1)^2. Inner derivative: 2x. Product: 6x(x^2+1)^2.' },
    },
    {
      id: 'diff_composite', name: 'Differentiating composite trig functions', level: 3, prior: 0.50,
      desc: 'Using the chain rule with a trigonometric outer function.',
      prereqs: [
        ['chain_rule', 0.95, 'The inner derivative must multiply the outer derivative.'],
        ['trig_deriv', 0.8, 'The outer derivative is a trigonometric derivative.'],
        ['power_rule', 0.6, 'The inner polynomial is differentiated by the power rule.'],
      ],
      lesson: {
        explain: 'Outer derivative, inner unchanged, times inner derivative. Check the sign of the trig derivative and the exponent multiplier last.',
        why: 'It brings the three skills together under exam pressure.',
        misconception: 'Differentiating the inner function inside the trig function as well.',
        example: { q: 'Differentiate sin(x^2).', a: 'cos(x^2) x 2x = 2x cos(x^2).' },
      },
      probe: { q: 'The derivative of cos(x^2) is:', options: ['-sin(x^2)', '-2x sin(x^2)', '2x sin(x^2)'], correct: 1 },
      practice: { q: 'The derivative of sin(4x^2) is:', options: ['8x cos(4x^2)', 'cos(4x^2)', '4x cos(4x^2)'], correct: 0, feedback: 'cos(4x^2) x 8x = 8x cos(4x^2).' },
    },
  ];

  const problems = [{
    id: 'chain-sin',
    title: 'Differentiate sin(3x^2 + 1)',
    target: 'diff_composite',
    difficulty: 'Core',
    gen() {
      return {
        statement: 'Differentiate f(x) = sin(3x^2 + 1) with respect to x. Enter your answer as an expression in x, for example 2x cos(x^2).',
        answer: { kind: 'expr', expr: '6x cos(3x^2+1)', display: '6x cos(3x^2 + 1)' },
        solution: ['Outer: sin, inner: u = 3x^2 + 1', 'du/dx = 6x', 'f\'(x) = cos(u) x du/dx = 6x cos(3x^2 + 1)'],
        setup: [/6\s*x/i], unitSensitive: false,
        patterns: [
          { expr: 'cos(3x^2+1)', cat: 'PREREQUISITE_GAP', concept: 'chain_rule', evidence: 'The answer is the outer derivative only: the inner derivative factor was dropped.' },
          { expr: '3x cos(3x^2+1)', cat: 'PROCEDURAL_ERROR', concept: 'power_rule', evidence: 'The inner derivative 3x shows the exponent multiplier was forgotten (d/dx 3x^2 is 6x).' },
          { expr: '-6x cos(3x^2+1)', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'A minus sign was added: that belongs to the derivative of cos, not sin.' },
          { expr: '6x sin(3x^2+1)', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'The derivative of sin was written as sin.' },
          { expr: '6x cos(6x)', cat: 'PREREQUISITE_GAP', concept: 'composite_fn', evidence: 'The inner function was differentiated inside the cosine as well as outside.' },
          { expr: '6x cos(3x^2)', cat: 'POSSIBLE_CARELESS_SLIP', concept: null, evidence: 'The +1 inside the cosine was lost while copying; the method is otherwise correct.' },
        ],
        keywords: [],
      };
    },
  }];

  const verification = [
    {
      id: 'chain-verify-cos',
      title: 'Fresh composite: cos of a quadratic',
      gen(rng) {
        const a = rng.int(2, 5);
        const b = rng.int(1, 4);
        const inner = a + 'x^2+' + b;
        return {
          statement: 'Find f\'(x) for f(x) = cos(' + a + 'x^2 + ' + b + '). Enter an expression in x.',
          answer: { kind: 'expr', expr: '-' + 2 * a + 'x sin(' + inner + ')', display: '-' + 2 * a + 'x sin(' + a + 'x^2 + ' + b + ')' },
          solution: ['Outer: cos, inner u = ' + a + 'x^2 + ' + b, 'du/dx = ' + 2 * a + 'x', 'f\'(x) = -sin(u) x du/dx = -' + 2 * a + 'x sin(' + inner + ')'],
          setup: [], unitSensitive: false,
          patterns: [
            { expr: '-sin(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'chain_rule', evidence: 'The inner derivative factor was dropped.' },
            { expr: '' + 2 * a + 'x sin(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'The minus sign in the derivative of cos was lost.' },
            { expr: '-' + a + 'x sin(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'power_rule', evidence: 'The exponent multiplier was forgotten in the inner derivative.' },
            { expr: '-' + 2 * a + 'x cos(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'The derivative of cos was written as -cos.' },
          ],
          keywords: [],
        };
      },
    },
    {
      id: 'chain-verify-sin',
      title: 'Fresh composite: sin of a cubic',
      gen(rng) {
        const a = rng.int(2, 4);
        const inner = a + 'x^3';
        return {
          statement: 'Differentiate g(x) = sin(' + a + 'x^3) with respect to x. Enter an expression in x.',
          answer: { kind: 'expr', expr: 3 * a + 'x^2 cos(' + inner + ')', display: 3 * a + 'x^2 cos(' + a + 'x^3)' },
          solution: ['Outer: sin, inner u = ' + inner, 'du/dx = ' + 3 * a + 'x^2', 'g\'(x) = ' + 3 * a + 'x^2 cos(' + inner + ')'],
          setup: [], unitSensitive: false,
          patterns: [
            { expr: 'cos(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'chain_rule', evidence: 'The inner derivative factor was dropped.' },
            { expr: a + 'x^2 cos(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'power_rule', evidence: 'The exponent multiplier 3 was forgotten.' },
            { expr: '-' + 3 * a + 'x^2 cos(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'A minus sign was added to the derivative of sin.' },
            { expr: 3 * a + 'x^2 sin(' + inner + ')', cat: 'PREREQUISITE_GAP', concept: 'trig_deriv', evidence: 'The derivative of sin was written as sin.' },
          ],
          keywords: [],
        };
      },
    },
  ];

  MT.data.register({
    id: 'jee-chain-rule', domainId: 'jee-maths', exam: 'JEE Main', subject: 'Mathematics', topic: 'Differentiation',
    blurb: 'The chain rule step that gets dropped under pressure.',
    target: 'diff_composite', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
