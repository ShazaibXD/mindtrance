/* First-year EEE: single-phase ideal transformers. The hero demo track. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const sig = (v) => MT.rng.sig(v, 3);

  const concepts = [
    {
      id: 'alg_rearrange', name: 'Formula rearrangement', level: 1, prior: 0.60,
      desc: 'Isolating one symbol in a formula by doing the same operation to both sides.',
      prereqs: [],
      lesson: {
        explain: 'To make a symbol the subject, undo what is done to it, in reverse order, on both sides. Multiplication is undone by division and the reverse.',
        why: 'Transformer ratios like V_1/V_2 = N_1/N_2 never come with the unknown already isolated.',
        misconception: 'Flipping a fraction on one side only, or moving a term across the equals sign without inverting its operation.',
        example: { q: 'Make V_2 the subject of V_1/V_2 = N_1/N_2.', a: 'Cross-multiply: V_1 N_2 = V_2 N_1, then divide by N_1: V_2 = V_1 N_2/N_1.' },
      },
      probe: { q: 'From V_1/V_2 = N_1/N_2, which expression gives V_2?', options: ['V_2 = V_1 N_1/N_2', 'V_2 = V_1 N_2/N_1', 'V_2 = N_2/(V_1 N_1)'], correct: 1 },
      practice: { q: 'Rearrange P = V I to make I the subject.', options: ['I = P V', 'I = P/V', 'I = V/P'], correct: 1, feedback: 'Divide both sides by V so I is left alone: I = P/V.' },
    },
    {
      id: 'unit_conv', name: 'SI prefixes (k, m, µ)', level: 1, prior: 0.75,
      desc: 'Converting between kilo, milli and micro prefixes and base units.',
      prereqs: [],
      lesson: {
        explain: 'Kilo means 1000 and milli means 1/1000. Convert every quantity to base units (V, A, Ω) before putting it in a formula.',
        why: 'A kV source treated as V is wrong by a factor of 1000 and no later step can repair it.',
        misconception: 'Dropping the prefix and keeping the number, for example using 2.4 for 2.4 kV.',
        example: { q: 'Convert 2.4 kV to volts.', a: '2.4 kV = 2.4 x 1000 V = 2400 V.' },
      },
      probe: { q: 'A supply is rated 3.3 kV. In volts that is:', options: ['3.3 V', '330 V', '3300 V'], correct: 2 },
      practice: { q: 'Convert 250 mA to amperes.', options: ['250 A', '0.25 A', '0.025 A'], correct: 1, feedback: 'Milli is 1/1000, so 250 mA = 250/1000 = 0.25 A.' },
    },
    {
      id: 'ohms_law', name: "Ohm's law and power", level: 1, prior: 0.80,
      desc: 'V = I R, and P = V I for resistive circuits.',
      prereqs: [],
      lesson: {
        explain: 'Voltage across a resistor equals current times resistance. For a known V and R the current is I = V/R.',
        why: 'The last step of nearly every transformer numerical is the load current from the secondary voltage.',
        misconception: 'Writing I = V R, or dividing the wrong way round.',
        example: { q: 'Current through 6 Ω with 30 V across it.', a: 'I = V/R = 30/6 = 5 A.' },
      },
      probe: { q: 'A 5 Ω resistor has 20 V across it. The current is:', options: ['100 A', '4 A', '0.25 A'], correct: 1 },
      practice: { q: 'A 12 V supply drives 3 A through a resistor. Its resistance is:', options: ['4 Ω', '36 Ω', '0.25 Ω'], correct: 0, feedback: 'R = V/I = 12/3 = 4 Ω.' },
    },
    {
      id: 'faraday', name: "Faraday's law and induced EMF", level: 2, prior: 0.70,
      desc: 'Induced EMF equals the rate of change of flux linkage.',
      prereqs: [['alg_rearrange', 0.4, 'Using e = N dΦ/dt in different forms needs rearrangement.']],
      lesson: {
        explain: 'A changing magnetic flux through N turns induces an EMF of magnitude N times the rate of change of flux. The same flux links both windings of a transformer.',
        why: 'It is the reason the voltage per turn is the same in both windings, which gives the turns ratio.',
        misconception: 'Believing a steady flux induces an EMF, or that EMF depends on the flux value instead of its rate of change.',
        example: { q: 'EMF in 50 turns when flux changes by 0.01 Wb in 0.1 s.', a: 'e = N x ΔΦ/Δt = 50 x 0.01/0.1 = 5 V.' },
      },
      probe: { q: "Faraday's law says induced EMF in a coil is proportional to the:", options: ['rate of change of flux linkage', 'value of the flux alone', 'resistance of the coil'], correct: 0 },
      practice: { q: 'A coil of 100 turns sees its flux change by 0.02 Wb in 0.1 s. The EMF magnitude is:', options: ['2 V', '20 V', '200 V'], correct: 1, feedback: 'e = N x ΔΦ/Δt = 100 x 0.02/0.1 = 20 V.' },
    },
    {
      id: 'turns_ratio', name: 'Turns, voltage and current ratios', level: 2, prior: 0.55,
      desc: 'V_1/V_2 = N_1/N_2 and I_1/I_2 = N_2/N_1 for an ideal transformer.',
      prereqs: [
        ['alg_rearrange', 0.8, 'Finding V_2 from V_1/V_2 = N_1/N_2 needs rearrangement.'],
        ['faraday', 0.6, 'Equal volts per turn in both windings comes from Faraday’s law.'],
      ],
      lesson: {
        explain: 'Voltage scales with turns: V_2 = V_1 x N_2/N_1. Power is conserved, so current scales the opposite way: I_2 = I_1 x N_1/N_2.',
        why: 'It converts a primary specification into the secondary quantities the load actually sees.',
        misconception: 'Applying N_1/N_2 to the voltage the wrong way up, so a step-down transformer steps the voltage up.',
        example: { q: 'N_1/N_2 = 5 and V_1 = 100 V. Find V_2.', a: 'Step-down, so V_2 is smaller: V_2 = 100 x N_2/N_1 = 100/5 = 20 V.' },
      },
      probe: { q: 'An ideal transformer has N_1 = 500 turns and N_2 = 50 turns. With V_1 = 100 V, V_2 is:', options: ['1000 V', '10 V', '50 V'], correct: 1 },
      practice: { q: 'A 1:5 step-up transformer (N_1:N_2) has V_1 = 20 V. V_2 is:', options: ['4 V', '100 V', '25 V'], correct: 1, feedback: 'N_2/N_1 = 5, so V_2 = 20 x 5 = 100 V.' },
    },
    {
      id: 'ideal_tx', name: 'Ideal transformer numericals', level: 3, prior: 0.50,
      desc: 'Combining ratios, unit conversion and Ohm’s law to find secondary quantities.',
      prereqs: [
        ['turns_ratio', 0.95, 'The secondary voltage must come from the turns ratio first.'],
        ['ohms_law', 0.75, 'Load current is found from secondary voltage and load resistance.'],
        ['unit_conv', 0.7, 'Ratings are often quoted in kV or mA and must be converted.'],
      ],
      lesson: {
        explain: 'Work in order: convert units, find V_2 from the ratio, then find I_2 from V_2 and the load. Check that output power equals input power.',
        why: 'It is the full chain that exam questions test, and each link can fail independently.',
        misconception: 'Applying Ohm’s law to the primary voltage and the secondary load, which mixes two sides of the transformer.',
        example: { q: 'Ideal 4:1 step-down, V_1 = 200 V, load 5 Ω. Find I_2.', a: 'V_2 = 200/4 = 50 V, then I_2 = 50/5 = 10 A.' },
      },
      probe: { q: 'In an ideal step-down transformer, power in equals power out. The secondary current compared with the primary current is:', options: ['smaller', 'equal', 'larger'], correct: 2 },
      practice: { q: 'Ideal 4:1 step-down, V_1 = 200 V, load 5 Ω. V_2 and I_2 are:', options: ['50 V, 10 A', '800 V, 160 A', '50 V, 0.1 A'], correct: 0, feedback: 'V_2 = 200/4 = 50 V and I_2 = 50/5 = 10 A.' },
    },
  ];

  const rearr = /N_?2\s*\/\s*N_?1|V_?2\s*=\s*V_?1\s*[x×*]\s*N_?2|[\/÷]\s*10\b/i;

  const problems = [
    {
      id: 'tx-secondary-current',
      title: 'Secondary current of a step-down transformer',
      target: 'ideal_tx',
      difficulty: 'Core',
      gen() {
        return {
          statement: 'A single-phase ideal step-down transformer has N_1/N_2 = 10. The primary is connected to V_1 = 240 V and the secondary feeds a resistive load R_L = 12 Ω. Find the secondary current I_2.',
          answer: { kind: 'number', value: 2, unit: 'A', tolPct: 1, display: '2 A' },
          solution: ['V_2 = V_1 N_2/N_1 = 240/10 = 24 V', 'I_2 = V_2/R_L = 24/12 = 2 A'],
          setup: [rearr, /24\s*V/i],
          unitSensitive: false,
          patterns: [
            { value: 200, cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The result 200 A follows from V_2 = 240 x 10 = 2400 V: the turns ratio was applied upside down.' },
            { value: 20, cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The result 20 A equals V_1/R_L: the transformer ratio was skipped and the primary voltage was put across the load.' },
            { value: 288, cat: 'PREREQUISITE_GAP', concept: 'ohms_law', evidence: 'The result 288 A equals V_2 x R_L: Ohm’s law was applied as I = V R.' },
            { value: 24, cat: 'READING_OR_INTERPRETATION_ERROR', concept: null, evidence: 'The result 24 matches the secondary voltage in volts, so the final step I_2 = V_2/R_L looks skipped rather than misunderstood.' },
          ],
          keywords: [
            { re: /V_?2\s*=\s*V_?1\s*[x×*]\s*N_?1|[x×*]\s*10\s*=\s*2400/i, cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The working multiplies V_1 by the ratio the wrong way round.' },
          ],
        };
      },
    },
    {
      id: 'tx-kv-primary',
      title: 'Load current with a kV primary',
      target: 'ideal_tx',
      difficulty: 'Unit trap',
      gen() {
        return {
          statement: 'An ideal 20:1 step-down transformer (N_1:N_2) is supplied at V_1 = 2.4 kV. The secondary load is R_L = 6 Ω. Find the secondary current I_2.',
          answer: { kind: 'number', value: 20, unit: 'A', tolPct: 1, display: '20 A' },
          solution: ['V_1 = 2.4 kV = 2400 V', 'V_2 = 2400/20 = 120 V', 'I_2 = 120/6 = 20 A'],
          setup: [/2400/i, /120\s*V/i],
          unitSensitive: true,
          patterns: [
            { value: 0.02, cat: 'CALCULATION_OR_UNIT_ERROR', concept: 'unit_conv', evidence: 'The result 0.02 A comes from using 2.4 instead of 2400 V: the kV prefix was dropped.' },
            { value: 400, cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The result 400 A equals 2400/6: the turns ratio was never applied.' },
            { value: 8000, cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The result 8000 A follows from stepping the voltage up to 48 kV: the ratio was inverted.' },
          ],
          keywords: [],
        };
      },
    },
  ];

  function nice(rng) {
    const RL = rng.pick([2, 4, 5, 6, 8, 10, 12]);
    const I2 = rng.pick([1, 1.5, 2, 2.5, 4, 5]);
    return { RL, I2, V2: sig(RL * I2) };
  }

  const verification = [
    {
      id: 'tx-verify-a',
      title: 'Fresh transformer: new ratio and load',
      gen(rng) {
        const { RL, I2, V2 } = nice(rng);
        const r = rng.pick([4, 5, 8, 10, 20]);
        const V1 = sig(V2 * r);
        return {
          statement: 'A workshop uses an ideal step-down transformer with turns ratio N_1:N_2 = ' + r + ':1. It is fed at V_1 = ' + V1 + ' V and supplies a heater of resistance R_L = ' + RL + ' Ω. What current does the heater draw?',
          answer: { kind: 'number', value: I2, unit: 'A', tolPct: 1, display: I2 + ' A' },
          solution: ['V_2 = ' + V1 + '/' + r + ' = ' + V2 + ' V', 'I_2 = ' + V2 + '/' + RL + ' = ' + I2 + ' A'],
          setup: [], unitSensitive: false,
          patterns: [
            { value: sig(V1 * r / RL), cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The ratio was applied upside down.' },
            { value: sig(V1 / RL), cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The ratio was skipped.' },
            { value: sig(V2 * RL), cat: 'PREREQUISITE_GAP', concept: 'ohms_law', evidence: 'Ohm’s law was applied as I = V R.' },
          ],
          keywords: [],
        };
      },
    },
    {
      id: 'tx-verify-b',
      title: 'Fresh transformer: kV supply',
      gen(rng) {
        const RL = rng.pick([10, 12, 20]);
        const I2 = rng.pick([5, 8, 10]);
        const V2 = RL * I2;
        const r = rng.pick([20, 25, 40]);
        const V1 = V2 * r;
        const kv = sig(V1 / 1000);
        return {
          statement: 'An ideal step-down transformer with N_1:N_2 = ' + r + ':1 is connected to a ' + kv + ' kV supply. A load of ' + RL + ' Ω is connected across the secondary. Find the load current.',
          answer: { kind: 'number', value: I2, unit: 'A', tolPct: 1, display: I2 + ' A' },
          solution: ['V_1 = ' + kv + ' kV = ' + V1 + ' V', 'V_2 = ' + V1 + '/' + r + ' = ' + V2 + ' V', 'I_2 = ' + V2 + '/' + RL + ' = ' + I2 + ' A'],
          setup: [], unitSensitive: true,
          patterns: [
            { value: sig(kv / r / RL), cat: 'CALCULATION_OR_UNIT_ERROR', concept: 'unit_conv', evidence: 'The kV prefix was dropped.' },
            { value: sig(V1 / RL), cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The ratio was skipped.' },
            { value: sig(V1 * r / RL), cat: 'PREREQUISITE_GAP', concept: 'turns_ratio', evidence: 'The ratio was applied upside down.' },
          ],
          keywords: [],
        };
      },
    },
  ];

  MT.data.register({
    id: 'eee-transformers',
    domainId: 'engineering',
    exam: 'B.Tech EEE',
    subject: 'Basic Electrical Engineering',
    topic: 'Single-phase transformers',
    blurb: 'Why a transformer numerical goes wrong: ratio direction, units, or Ohm’s law.',
    target: 'ideal_tx',
    concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
