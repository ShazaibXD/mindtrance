/* First-year CSE: negative numbers in binary using two's complement. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  /* An integer as an 8-bit pattern, returned as a Number such as 11110011 so it can be compared as an answer. */
  const bits = (n) => Number((((n % 256) + 256) % 256).toString(2).padStart(8, '0'));
  const rev = (n) => Number(String(n).padStart(8, '0').split('').reverse().join(''));

  const concepts = [
    {
      id: 'place_value', name: 'Binary place value', level: 1, prior: 0.75,
      desc: 'Each binary digit is worth a power of two, doubling from right to left.', prereqs: [],
      lesson: {
        explain: 'From the right, the places are worth 1, 2, 4, 8, 16 and so on. Add the places that hold a 1.',
        why: 'Every conversion and every check of a two\'s complement answer relies on reading place values.',
        misconception: 'Reading binary digits as if they were decimal digits, so 1010 becomes one thousand and ten.',
        example: { q: 'Value of 1101.', a: '8 + 4 + 0 + 1 = 13.' },
      },
      probe: { q: 'The binary number 1010 equals which decimal number?', options: ['5', '10', '20'], correct: 1 },
      practice: { q: 'The binary number 1101 equals:', options: ['11', '13', '14'], correct: 1, feedback: '8 + 4 + 1 = 13.' },
    },
    {
      id: 'div_remainder', name: 'Repeated division by 2', level: 1, prior: 0.65,
      desc: 'Converting a decimal number to binary by dividing by 2 and reading remainders upwards.', prereqs: [],
      lesson: {
        explain: 'Divide by 2 again and again, noting each remainder. The first remainder is the lowest bit, so read the remainders from last to first.',
        why: 'The magnitude of a negative number must be written in binary before it can be negated.',
        misconception: 'Writing the remainders in the order they were produced, which reverses the bits.',
        example: { q: 'Convert 6 to binary.', a: '6/2 = 3 r0, 3/2 = 1 r1, 1/2 = 0 r1. Read upwards: 110.' },
      },
      probe: { q: 'Dividing 6 by 2 repeatedly gives remainders 0, 1, 1 in that order. The binary number is:', options: ['011', '110', '101'], correct: 1 },
      practice: { q: 'The binary form of 10 is:', options: ['1010', '0101', '1100'], correct: 0, feedback: '10/2 = 5 r0, 5/2 = 2 r1, 2/2 = 1 r0, 1/2 = 0 r1. Read upwards: 1010.' },
    },
    {
      id: 'bit_invert', name: 'Inverting bits', level: 1, prior: 0.70,
      desc: 'Flipping every bit: 0 becomes 1 and 1 becomes 0 (the one\'s complement).', prereqs: [],
      lesson: {
        explain: 'Inverting means flipping every bit in the fixed width, including leading zeros.',
        why: 'The first step of negating a number in two\'s complement is inverting all its bits.',
        misconception: 'Skipping the leading zeros, so only part of the number is inverted.',
        example: { q: 'Invert 8-bit 00001101.', a: '11110010.' },
      },
      probe: { q: 'Invert the 4-bit number 1010:', options: ['1010', '0101', '0110'], correct: 1 },
      practice: { q: 'Invert the 5-bit number 11001:', options: ['00110', '00111', '11001'], correct: 0, feedback: 'Flip every bit: 11001 becomes 00110.' },
    },
    {
      id: 'binary_add', name: 'Binary addition with carry', level: 2, prior: 0.55,
      desc: '1 + 1 = 10 in binary: write 0 and carry 1.',
      prereqs: [['place_value', 0.6, 'Carries move one place value to the left.']],
      lesson: {
        explain: 'Add column by column from the right. 1 + 1 gives 0 with a carry of 1 into the next column.',
        why: 'The "+1" step of two\'s complement is a binary addition whose carry can ripple through several bits.',
        misconception: 'Forgetting to carry, or adding 1 only to the last digit when it is already 1.',
        example: { q: '0111 + 0001.', a: 'The carry ripples: 1000.' },
      },
      probe: { q: '0111 + 0001 in binary equals:', options: ['0112', '1000', '0110'], correct: 1 },
      practice: { q: '1011 + 0011 equals:', options: ['1110', '1100', '10010'], correct: 0, feedback: '11 + 3 = 14, which is 1110.' },
    },
    {
      id: 'sign_repr', name: 'How two\'s complement stores negatives', level: 2, prior: 0.55,
      desc: 'The leading bit has a negative weight, so negatives can be added like positives.',
      prereqs: [['place_value', 0.5, 'The leading bit is a place value with a negative weight.']],
      lesson: {
        explain: 'In n-bit two\'s complement the leading bit is worth minus 2^(n-1). So 11111111 is -128 + 127 = -1, and a leading 1 means the number is negative.',
        why: 'It explains why simply setting a sign bit is wrong and why the same adder works for signed and unsigned numbers.',
        misconception: 'Treating the leading bit as a plain sign flag (sign-magnitude): -13 becomes 10001101.',
        example: { q: 'What does 11111111 represent in 8-bit two\'s complement?', a: '-128 + 64 + 32 + 16 + 8 + 4 + 2 + 1 = -1.' },
      },
      probe: { q: 'In 8-bit two\'s complement, a leading bit of 1 means the number is:', options: ['negative', 'even', 'greater than 127 in magnitude'], correct: 0 },
      practice: { q: 'Which 8-bit pattern represents -1 in two\'s complement?', options: ['10000001', '11111111', '00000001'], correct: 1, feedback: 'All ones is -128 + 127 = -1. 10000001 would be -127.' },
    },
    {
      id: 'twos_comp', name: 'Two\'s complement of a number', level: 3, prior: 0.50,
      desc: 'Write the magnitude, invert every bit, add 1.',
      prereqs: [
        ['div_remainder', 0.8, 'The magnitude has to be converted to binary first.'],
        ['bit_invert', 0.85, 'Every bit is inverted in the fixed width.'],
        ['binary_add', 0.9, 'Then 1 is added, and the carry can ripple.'],
        ['sign_repr', 0.7, 'It tells you what the resulting pattern means.'],
      ],
      lesson: {
        explain: 'To write -n in w bits: write n in w bits, invert every bit, then add 1. Check: the leading bit must be 1.',
        why: 'Signed binary arithmetic in hardware and in exam questions uses this recipe.',
        misconception: 'Stopping after inverting (one\'s complement), which is off by exactly one.',
        example: { q: 'Write -5 in 4 bits.', a: '0101, invert to 1010, add 1 to get 1011.' },
      },
      probe: { q: 'The 4-bit two\'s complement of 0001 is:', options: ['1110', '1111', '1001'], correct: 1 },
      practice: { q: 'The 4-bit two\'s complement representation of -3 is:', options: ['1100', '1101', '1011'], correct: 1, feedback: '3 is 0011, inverted 1100, plus 1 gives 1101.' },
    },
  ];

  function pats(n) {
    const mag = n; const ans = (256 - n) % 256;
    const forgetOne = (ans + 255) % 256;
    return [
      { value: bits(forgetOne), cat: 'PROCEDURAL_ERROR', concept: 'binary_add', evidence: 'The bits were inverted but 1 was never added: this is the one\'s complement, off by one.' },
      { value: bits(128 + mag), cat: 'PREREQUISITE_GAP', concept: 'sign_repr', evidence: 'Only the leading bit was set: that is sign-magnitude, not two\'s complement.' },
      { value: bits(mag), cat: 'PREREQUISITE_GAP', concept: 'bit_invert', evidence: 'The positive binary number was given: the bits were never inverted.' },
      { value: rev(bits(mag)), cat: 'PROCEDURAL_ERROR', concept: 'div_remainder', evidence: 'The magnitude\'s bits appear reversed: the remainders were read in the order produced.' },
    ];
  }
  const dedupe = (ps, answer) => { const seen = new Set([answer]); return ps.filter((p) => (seen.has(p.value) ? false : seen.add(p.value))); };

  const mk = (statement, n, solution) => {
    const value = bits((256 - n) % 256);
    return {
      statement,
      answer: { kind: 'number', value, unit: '', tolPct: 0, exact: true, display: String(value).padStart(8, '0') },
      solution, setup: [], unitSensitive: false,
      patterns: dedupe(pats(n), value), keywords: [],
    };
  };
  const steps = (n) => ['|n| = ' + n + ' = ' + n.toString(2).padStart(8, '0'), 'Invert every bit: ' + (255 - n).toString(2).padStart(8, '0'), 'Add 1: ' + ((256 - n) % 256).toString(2).padStart(8, '0')];

  const problems = [{
    id: 'twos-minus-13',
    title: 'Write -13 as an 8-bit two\'s complement number',
    target: 'twos_comp',
    difficulty: 'Core',
    gen() { return mk('Write the decimal number -13 as an 8-bit two\'s complement binary number. Enter the 8 bits.', 13, steps(13)); },
  }];

  const verification = [
    {
      id: 'twos-verify-negate',
      title: 'Fresh negation',
      gen(rng) {
        const n = rng.pick([5, 9, 11, 18, 22, 27, 37, 42, 55, 70, 99]);
        return mk('A microcontroller stores signed bytes in two\'s complement. What 8-bit pattern stores the value -' + n + '?', n, steps(n));
      },
    },
    {
      id: 'twos-verify-subtract',
      title: 'Fresh subtraction',
      gen(rng) {
        const a = rng.pick([3, 7, 12, 20, 25]);
        const b = a + rng.pick([4, 9, 14, 21, 30]);
        const n = b - a;
        const res = mk('Using 8-bit two\'s complement arithmetic, a program computes ' + a + ' - ' + b + '. What 8-bit pattern is the result?', n, ['a - b = -' + n, ...steps(n)]);
        return res;
      },
    },
  ];

  MT.data.register({
    id: 'cse-twos-complement', domainId: 'engineering', exam: 'B.Tech CSE', subject: 'Digital Logic and Number Systems', topic: 'Two\'s complement',
    blurb: 'Why -13 is not just 13 with a sign bit, and where the +1 goes.',
    target: 'twos_comp', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
