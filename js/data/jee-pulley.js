/* JEE Physics: a block hanging from a disc pulley. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const sig = (v) => MT.rng.sig(v, 3);

  const concepts = [
    {
      id: 'newton2', name: "Newton's second law", level: 1, prior: 0.75,
      desc: 'Net force on a body equals mass times acceleration.', prereqs: [],
      lesson: {
        explain: 'Add the forces along the direction of motion, taking the direction of acceleration as positive. The sum equals m a.',
        why: 'The hanging block gives the first equation of the problem: m g - T = m a.',
        misconception: 'Setting the net force to zero because the block "just hangs".',
        example: { q: 'A 3 kg block is pulled up with tension 40 N (g = 10). Find a.', a: 'Net force up = 40 - 30 = 10 N, so a = 10/3 = 3.3 m/s^2 upward.' },
      },
      probe: { q: 'A 2 kg block has a 30 N force acting up and its weight (20 N) acting down. Its acceleration is:', options: ['5 m/s^2 up', '15 m/s^2 up', '5 m/s^2 down'], correct: 0 },
      practice: { q: 'A 5 kg trolley is pushed with a net force of 20 N. Its acceleration is:', options: ['100 m/s^2', '4 m/s^2', '0.25 m/s^2'], correct: 1, feedback: 'a = F/m = 20/5 = 4 m/s^2.' },
    },
    {
      id: 'fbd_tension', name: 'Free-body diagrams and tension', level: 1, prior: 0.60,
      desc: 'Drawing the forces on each body and treating tension as an unknown force.', prereqs: [],
      lesson: {
        explain: 'Draw each body separately and label every force on it. Tension is a pulling force that is unknown until you solve for it.',
        why: 'Without a correct diagram, the block and the pulley end up with incompatible equations.',
        misconception: 'Assuming T = mg. That is only true when the block is not accelerating.',
        example: { q: 'Why is T not equal to mg for a falling block on a string?', a: 'The block accelerates downward, so mg - T = ma and T is less than mg.' },
      },
      probe: { q: 'A block hangs from a string and accelerates downward. The string tension is:', options: ['equal to mg', 'greater than mg', 'less than mg'], correct: 2 },
      practice: { q: 'A lift cable holds a 100 kg load that accelerates upward. Tension compared with weight is:', options: ['greater', 'equal', 'smaller'], correct: 0, feedback: 'To accelerate upward, the net force is upward, so T - mg > 0.' },
    },
    {
      id: 'moment_inertia', name: 'Moment of inertia of a disc', level: 1, prior: 0.55,
      desc: 'I = (1/2) M R^2 for a solid disc, I = M R^2 for a thin hoop.', prereqs: [],
      lesson: {
        explain: 'Moment of inertia measures how mass is spread about the axis. A solid disc has I = (1/2) M R^2. A hoop, with all mass at the rim, has I = M R^2.',
        why: 'The pulley resists angular acceleration through I, which decides how much of the weight goes into spinning it.',
        misconception: 'Using I = M R^2 for every round object.',
        example: { q: 'I of a solid disc of mass 4 kg and radius 0.2 m.', a: 'I = (1/2)(4)(0.2)^2 = 0.08 kg m^2.' },
      },
      probe: { q: 'The moment of inertia of a solid disc about its central axis is:', options: ['M R^2', '(1/2) M R^2', '(2/5) M R^2'], correct: 1 },
      practice: { q: 'A solid disc has M = 2 kg and R = 0.5 m. Its I is:', options: ['0.25 kg m^2', '0.5 kg m^2', '1 kg m^2'], correct: 0, feedback: 'I = (1/2) M R^2 = 0.5 x 2 x 0.25 = 0.25 kg m^2.' },
    },
    {
      id: 'constraint', name: 'String constraint a = αR', level: 2, prior: 0.55,
      desc: 'A string that does not slip links linear and angular acceleration.',
      prereqs: [['fbd_tension', 0.6, 'The same tension pulls the block and acts on the rim, which is what links them.']],
      lesson: {
        explain: 'If the string does not slip, a point on the rim moves like the string: a = α R. Linear acceleration is angular acceleration times the radius.',
        why: 'It is the equation that joins the block’s motion to the pulley’s rotation.',
        misconception: 'Writing a = α and forgetting R, which gives the wrong units.',
        example: { q: 'A pulley of radius 0.1 m has α = 20 rad/s^2. Find the string acceleration.', a: 'a = α R = 20 x 0.1 = 2 m/s^2.' },
      },
      probe: { q: 'A pulley of radius 0.5 m spins with α = 4 rad/s^2. The string acceleration is:', options: ['8 m/s^2', '2 m/s^2', '4 m/s^2'], correct: 1 },
      practice: { q: 'A string moves at a = 3 m/s^2 over a wheel of radius 0.3 m. α is:', options: ['0.9 rad/s^2', '10 rad/s^2', '3 rad/s^2'], correct: 1, feedback: 'α = a/R = 3/0.3 = 10 rad/s^2.' },
    },
    {
      id: 'torque_alpha', name: 'Torque and angular acceleration', level: 2, prior: 0.55,
      desc: 'τ = I α, with torque from a tangential force τ = F R.',
      prereqs: [
        ['moment_inertia', 0.8, 'The value of I decides the angular acceleration.'],
        ['newton2', 0.5, 'Rotation uses the same idea as F = m a with torque and I.'],
      ],
      lesson: {
        explain: 'A force F applied tangentially at radius R gives torque F R. Net torque equals I times angular acceleration.',
        why: 'It gives the second equation of the problem: T R = I α.',
        misconception: 'Forgetting that torque needs the radius, so using T = I α directly.',
        example: { q: 'Tension 10 N on a rim of radius 0.2 m, I = 0.08 kg m^2. Find α.', a: 'τ = 10 x 0.2 = 2 N m, α = τ/I = 2/0.08 = 25 rad/s^2.' },
      },
      probe: { q: 'A tangential force of 5 N acts at radius 0.4 m on a wheel with I = 0.5 kg m^2. α is:', options: ['4 rad/s^2', '10 rad/s^2', '25 rad/s^2'], correct: 0 },
      practice: { q: 'A torque of 6 N m acts on a body with I = 2 kg m^2. α is:', options: ['12 rad/s^2', '3 rad/s^2', '0.33 rad/s^2'], correct: 1, feedback: 'α = τ/I = 6/2 = 3 rad/s^2.' },
    },
    {
      id: 'pulley_dynamics', name: 'Block and massive pulley', level: 3, prior: 0.50,
      desc: 'Combining block, pulley and string equations to find acceleration and tension.',
      prereqs: [
        ['torque_alpha', 0.9, 'The pulley equation T R = I α gives the tension.'],
        ['constraint', 0.85, 'a = α R joins the two equations.'],
        ['fbd_tension', 0.8, 'The block equation needs the right forces and an unknown T.'],
      ],
      lesson: {
        explain: 'Write m g - T = m a for the block, T R = I α for the pulley and a = α R for the string. Eliminating T and α gives a = m g / (m + I/R^2).',
        why: 'This is the standard chain in JEE rotational mechanics and each link can fail separately.',
        misconception: 'Treating the pulley as massless in a problem that gives its mass.',
        example: { q: 'm = 1 kg, solid disc M = 2 kg. Find a (g = 10).', a: 'I/R^2 = M/2 = 1 kg, so a = 10/(1+1) = 5 m/s^2.' },
      },
      probe: { q: 'A heavier pulley (larger I) is used with the same hanging block. The block’s acceleration:', options: ['increases', 'stays the same', 'decreases'], correct: 2 },
      practice: { q: 'm = 2 kg hangs from a solid disc of M = 2 kg (g = 10). The acceleration is:', options: ['10 m/s^2', '6.67 m/s^2', '5 m/s^2'], correct: 1, feedback: 'I/R^2 = 1 kg, a = 20/(2+1) = 6.67 m/s^2.' },
    },
  ];

  const base = { setup: [/T\s*R|τ|torque/i, /mg\s*-\s*T|m\s*g\s*-\s*T/i], unitSensitive: false };

  const problems = [{
    id: 'pulley-acceleration',
    title: 'Acceleration of a block on a disc pulley',
    target: 'pulley_dynamics',
    difficulty: 'Advanced',
    gen() {
      return Object.assign({}, base, {
        statement: 'A block of mass 2 kg hangs from a light string wrapped around a solid disc pulley of mass 4 kg and radius 0.2 m. The string does not slip. Taking g = 10 m/s^2, find the downward acceleration of the block.',
        answer: { kind: 'number', value: 5, unit: 'm/s^2', tolPct: 1, display: '5 m/s^2' },
        solution: ['I = (1/2) M R^2, so I/R^2 = M/2 = 2 kg', 'm g - T = m a, T R = I α, a = α R', 'a = m g/(m + M/2) = 20/4 = 5 m/s^2'],
        patterns: [
          { value: 10, cat: 'PREREQUISITE_GAP', concept: 'fbd_tension', evidence: 'The result 10 m/s^2 is free fall: the string tension was ignored, as if T = 0.' },
          { value: 3.33, cat: 'PREREQUISITE_GAP', concept: 'moment_inertia', evidence: 'The result 3.33 m/s^2 follows from I = M R^2: the disc was treated as a hoop.' },
          { value: 8.33, cat: 'PROCEDURAL_ERROR', concept: 'constraint', evidence: 'The result 8.33 m/s^2 follows from using α = a without the radius.' },
        ],
        keywords: [
          { re: /I\s*=\s*M\s*R\s*(\^\s*2|²|2)(?!\s*\/\s*2)/i, cat: 'PREREQUISITE_GAP', concept: 'moment_inertia', evidence: 'The working uses I = M R^2, which is the moment of inertia of a hoop, not a solid disc.' },
          { re: /α\s*=\s*a(?![\/\w])|alpha\s*=\s*a(?![\/\w])/i, cat: 'PREREQUISITE_GAP', concept: 'constraint', evidence: 'The working sets α = a with no radius.' },
        ],
      });
    },
  }];


  const verification = [
    {
      id: 'pulley-verify-a',
      title: 'Fresh pulley: new masses',
      gen(rng) {
        const m = rng.pick([1, 3, 4, 5]);
        const M = rng.pick([2, 6, 8, 10]);
        const R = rng.pick([0.1, 0.15, 0.25, 0.3]);
        const a = sig(10 * m / (m + M / 2));
        return Object.assign({}, base, {
          statement: 'A ' + m + ' kg bucket is tied to a rope wound on a solid cylindrical winch of mass ' + M + ' kg and radius ' + R + ' m. The rope does not slip. With g = 10 m/s^2, find the acceleration of the bucket when it is released.',
          answer: { kind: 'number', value: a, unit: 'm/s^2', tolPct: 1, display: a + ' m/s^2' },
          solution: ['I/R^2 = M/2 = ' + M / 2 + ' kg', 'a = m g/(m + M/2) = ' + 10 * m + '/' + (m + M / 2) + ' = ' + a + ' m/s^2'],
          patterns: [
            { value: 10, cat: 'PREREQUISITE_GAP', concept: 'fbd_tension', evidence: 'Free fall: tension ignored.' },
            { value: sig(10 * m / (m + M)), cat: 'PREREQUISITE_GAP', concept: 'moment_inertia', evidence: 'The winch was treated as a hoop.' },
            { value: sig(10 * m / (m + 0.5 * M * R)), cat: 'PROCEDURAL_ERROR', concept: 'constraint', evidence: 'The radius was dropped from a = α R.' },
          ],
          keywords: [],
        });
      },
    },
    {
      id: 'pulley-verify-b',
      title: 'Fresh pulley: find the tension',
      gen(rng) {
        const m = rng.pick([2, 3, 4, 6]);
        const M = rng.pick([2, 4, 6, 8]);
        const R = rng.pick([0.1, 0.2, 0.25]);
        const a = 10 * m / (m + M / 2);
        const T = sig(M * a / 2);
        const aHalf = 10 * m / (m + 0.5 * M * R);
        return Object.assign({}, base, {
          statement: 'A ' + m + ' kg load hangs from a cable wrapped round a solid drum of mass ' + M + ' kg and radius ' + R + ' m. The cable does not slip. Taking g = 10 m/s^2, find the tension in the cable while the load descends.',
          answer: { kind: 'number', value: T, unit: 'N', tolPct: 1, display: T + ' N' },
          solution: ['a = m g/(m + M/2) = ' + sig(a) + ' m/s^2', 'T = m(g - a) = ' + T + ' N'],
          patterns: [
            { value: m * 10, cat: 'PREREQUISITE_GAP', concept: 'fbd_tension', evidence: 'The result is m g: tension was assumed equal to the weight.' },
            { value: sig(M * (10 * m / (m + M))), cat: 'PREREQUISITE_GAP', concept: 'moment_inertia', evidence: 'The drum was treated as a hoop.' },
            { value: sig(0.5 * M * R * aHalf), cat: 'PROCEDURAL_ERROR', concept: 'constraint', evidence: 'The radius was dropped from a = α R.' },
          ],
          keywords: [],
        });
      },
    },
  ];

  MT.data.register({
    id: 'jee-pulley', domainId: 'jee-physics', exam: 'JEE Advanced', subject: 'Physics', topic: 'Rotational dynamics',
    blurb: 'A hanging mass and a spinning disc: where does the weight go?',
    target: 'pulley_dynamics', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
