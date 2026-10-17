/* NEET Biology: Hardy-Weinberg equilibrium. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const sig = (v) => MT.rng.sig(v, 4);

  const concepts = [
    {
      id: 'sqrt_root', name: 'Square roots of decimals', level: 1, prior: 0.80,
      desc: 'Finding q from q^2, for example sqrt(0.04) = 0.2.', prereqs: [],
      lesson: {
        explain: 'Square root undoes squaring. For decimals count places: 0.04 is 4 hundredths, so its root is 2 tenths, 0.2.',
        why: 'The recessive allele frequency q is the square root of the recessive phenotype frequency.',
        misconception: 'Reading sqrt(0.04) as 0.4 or 0.02.',
        example: { q: 'sqrt(0.09)', a: '0.3 because 0.3 x 0.3 = 0.09.' },
      },
      probe: { q: 'The square root of 0.16 is:', options: ['0.04', '0.4', '0.08'], correct: 1 },
      practice: { q: 'The square root of 0.25 is:', options: ['0.5', '0.05', '0.125'], correct: 0, feedback: '0.5 x 0.5 = 0.25.' },
    },
    {
      id: 'p_plus_q', name: 'p + q = 1', level: 1, prior: 0.70,
      desc: 'The two allele frequencies at a locus add to one.', prereqs: [],
      lesson: {
        explain: 'With two alleles, every allele in the gene pool is either A or a, so p + q = 1 and p = 1 - q.',
        why: 'Once q is known, p follows immediately and the heterozygote frequency 2pq can be computed.',
        misconception: 'Treating p and q as independent numbers that need not add to one.',
        example: { q: 'q = 0.3, find p.', a: 'p = 1 - 0.3 = 0.7.' },
      },
      probe: { q: 'If q = 0.1 then p is:', options: ['0.9', '0.1', '0.01'], correct: 0 },
      practice: { q: 'If p = 0.6 then q is:', options: ['0.6', '0.36', '0.4'], correct: 2, feedback: 'q = 1 - p = 0.4.' },
    },
    {
      id: 'allele_vs_genotype', name: 'Allele vs genotype frequency', level: 1, prior: 0.55,
      desc: 'p and q count alleles. p^2, 2pq and q^2 count genotypes.', prereqs: [],
      lesson: {
        explain: 'q is the fraction of alleles that are a. The fraction of people who are aa is q^2, because each carries two a alleles.',
        why: 'The question gives a genotype frequency (aa) and asks for another (Aa), so mixing the two kinds of frequency ruins the answer.',
        misconception: 'Using the proportion of affected people directly as q.',
        example: { q: '9% of people are aa. What is q?', a: 'q^2 = 0.09 so q = 0.3. The 9% is a genotype frequency, not q.' },
      },
      probe: { q: '16% of a population shows a recessive trait (aa). The frequency of the a allele is:', options: ['0.16', '0.4', '0.84'], correct: 1 },
      practice: { q: 'q = 0.2. The frequency of aa individuals is:', options: ['0.2', '0.04', '0.4'], correct: 1, feedback: 'aa frequency = q^2 = 0.04.' },
    },
    {
      id: 'hw_equation', name: 'Hardy-Weinberg equation', level: 2, prior: 0.55,
      desc: 'p^2 + 2pq + q^2 = 1 for genotype frequencies at equilibrium.',
      prereqs: [
        ['allele_vs_genotype', 0.8, 'The terms are genotype frequencies built from allele frequencies.'],
        ['p_plus_q', 0.7, 'p must be found from q before 2pq can be computed.'],
      ],
      lesson: {
        explain: 'AA = p^2, Aa = 2pq and aa = q^2. The factor 2 appears because the heterozygote can form in two ways.',
        why: 'It is the model that links the visible recessive phenotype to the hidden carrier frequency.',
        misconception: 'Writing the heterozygote frequency as pq and forgetting the 2.',
        example: { q: 'p = 0.7, q = 0.3. Aa frequency?', a: '2pq = 2 x 0.7 x 0.3 = 0.42.' },
      },
      probe: { q: 'In Hardy-Weinberg terms the heterozygote frequency is:', options: ['pq', '2pq', 'p^2 + q^2'], correct: 1 },
      practice: { q: 'p = 0.5 and q = 0.5. The frequency of Aa is:', options: ['0.25', '0.5', '1'], correct: 1, feedback: '2pq = 2 x 0.5 x 0.5 = 0.5.' },
    },
    {
      id: 'hw_carriers', name: 'Carrier frequency from a recessive trait', level: 3, prior: 0.50,
      desc: 'From the aa frequency to q, then p, then the Aa frequency.',
      prereqs: [
        ['hw_equation', 0.9, 'The carrier frequency is the 2pq term.'],
        ['sqrt_root', 0.7, 'q is the square root of the aa frequency.'],
      ],
      lesson: {
        explain: 'Take q = sqrt(aa frequency), then p = 1 - q, then carriers = 2pq. Keep track of which quantity each number represents.',
        why: 'This is the standard NEET population-genetics numerical.',
        misconception: 'Answering with q, with q^2 or with p^2 because they are the numbers already on the page.',
        example: { q: '1% are aa. Carrier frequency?', a: 'q = 0.1, p = 0.9, 2pq = 0.18.' },
      },
      probe: { q: 'In a population in equilibrium, the carriers (Aa) are:', options: ['always fewer than aa', 'usually far more common than aa for a rare trait', 'equal to aa'], correct: 1 },
      practice: { q: '1% of a population is aa. The carrier frequency is:', options: ['0.1', '0.18', '0.01'], correct: 1, feedback: 'q = 0.1, p = 0.9, 2pq = 0.18.' },
    },
  ];

  const problems = [{
    id: 'hw-carriers',
    title: 'Carrier frequency in a population',
    target: 'hw_carriers',
    difficulty: 'Core',
    gen() {
      return {
        statement: 'In a human population in Hardy-Weinberg equilibrium, 4% of individuals show a recessive trait (aa). What is the frequency of carriers (Aa)? Give a decimal or a percentage.',
        answer: { kind: 'number', value: 0.32, unit: '', tolAbs: 0.005, percentOk: true, exact: true, display: '0.32 (32%)' },
        solution: ['q^2 = 0.04 so q = 0.2', 'p = 1 - q = 0.8', 'Aa = 2pq = 2 x 0.8 x 0.2 = 0.32'],
        setup: [/2\s*p\s*q|2\s*[x*×]\s*0?\.8/i, /q\s*=\s*0?\.2/i], unitSensitive: false,
        patterns: [
          { value: 0.04, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The result 0.04 is the aa frequency itself, which was given in the question.' },
          { value: 0.2, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The result 0.2 is the allele frequency q, not the carrier frequency.' },
          { value: 0.8, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The result 0.8 is the allele frequency p, not the carrier frequency.' },
          { value: 0.16, cat: 'PROCEDURAL_ERROR', concept: 'hw_equation', evidence: 'The result 0.16 equals p x q: the factor 2 for heterozygotes is missing.' },
          { value: 0.64, cat: 'PREREQUISITE_GAP', concept: 'hw_equation', evidence: 'The result 0.64 equals p^2, which is the AA homozygote, not the heterozygote.' },
          { value: 0.48, cat: 'PREREQUISITE_GAP', concept: 'sqrt_root', evidence: 'The result 0.48 follows from q = 0.4: the square root of 0.04 was misread.' },
        ],
        keywords: [
          { re: /q\s*=\s*0?\.04\b/i, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The working sets q = 0.04, but 0.04 is q^2.' },
        ],
      };
    },
  }];

  const verification = [
    {
      id: 'hw-verify-percent',
      title: 'Fresh population: heterozygote percentage',
      gen(rng) {
        const q = rng.pick([0.1, 0.2, 0.3, 0.4, 0.6, 0.7]);
        const aa = sig(q * q);
        const p = sig(1 - q);
        const het = sig(2 * p * q);
        return {
          statement: 'A recessive allergy affects ' + sig(aa * 100) + '% of a population that is in Hardy-Weinberg equilibrium for a single gene with two alleles. What fraction of the population are heterozygous carriers? Give a decimal or a percentage.',
          answer: { kind: 'number', value: het, unit: '', tolAbs: 0.005, percentOk: true, exact: true, display: het + ' (' + sig(het * 100) + '%)' },
          solution: ['q = sqrt(' + aa + ') = ' + q, 'p = 1 - q = ' + p, '2pq = ' + het],
          setup: [], unitSensitive: false,
          patterns: [
            { value: aa, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The given aa frequency was repeated.' },
            { value: q, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The allele frequency q was reported.' },
            { value: p, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The allele frequency p was reported.' },
            { value: sig(p * q), cat: 'PROCEDURAL_ERROR', concept: 'hw_equation', evidence: 'The factor 2 in 2pq is missing.' },
            { value: sig(p * p), cat: 'PREREQUISITE_GAP', concept: 'hw_equation', evidence: 'p^2 (AA) was reported instead of 2pq.' },
          ],
          keywords: [],
        };
      },
    },
    {
      id: 'hw-verify-count',
      title: 'Fresh population: carrier headcount',
      gen(rng) {
        const q = rng.pick([0.1, 0.2, 0.3, 0.4]);
        const N = rng.pick([1000, 2000, 5000, 10000]);
        const aaN = Math.round(q * q * N);
        const hetN = Math.round(2 * q * (1 - q) * N);
        return {
          statement: 'In a town of ' + N + ' people (Hardy-Weinberg equilibrium), ' + aaN + ' have a recessive genetic condition. How many people are expected to be carriers?',
          answer: { kind: 'number', value: hetN, unit: '', tolPct: 1, exact: true, display: String(hetN) },
          solution: ['aa frequency = ' + aaN + '/' + N + ' = ' + sig(q * q), 'q = ' + q + ', p = ' + sig(1 - q), 'carriers = 2pq x ' + N + ' = ' + hetN],
          setup: [], unitSensitive: false,
          patterns: [
            { value: aaN, cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'The number of aa people was repeated.' },
            { value: Math.round(q * N), cat: 'PREREQUISITE_GAP', concept: 'allele_vs_genotype', evidence: 'q x N was used: an allele frequency was treated as a headcount.' },
            { value: Math.round(q * (1 - q) * N), cat: 'PROCEDURAL_ERROR', concept: 'hw_equation', evidence: 'The factor 2 in 2pq is missing.' },
            { value: Math.round((1 - q) * (1 - q) * N), cat: 'PREREQUISITE_GAP', concept: 'hw_equation', evidence: 'p^2 x N (AA people) was reported.' },
          ],
          keywords: [],
        };
      },
    },
  ];

  MT.data.register({
    id: 'neet-hardy-weinberg', domainId: 'neet-biology', exam: 'NEET UG', subject: 'Biology', topic: 'Population genetics',
    blurb: 'Allele frequency versus genotype frequency, and where the 2 in 2pq goes.',
    target: 'hw_carriers', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
