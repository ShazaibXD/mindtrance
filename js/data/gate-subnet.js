/* GATE CS: counting usable hosts in an IPv4 subnet. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  const concepts = [
    {
      id: 'powers_of_two', name: 'Powers of two', level: 1, prior: 0.80,
      desc: 'n binary digits can represent 2^n distinct values.', prereqs: [],
      lesson: {
        explain: 'Each extra bit doubles the number of combinations. 6 bits give 2^6 = 64 values.',
        why: 'The number of addresses in a subnet is a power of two set by the host bits.',
        misconception: 'Treating the bit count as the number of values, or multiplying by 2 instead of raising to a power.',
        example: { q: 'How many values can 5 bits take?', a: '2^5 = 32.' },
      },
      probe: { q: '2^7 equals:', options: ['14', '128', '49'], correct: 1 },
      practice: { q: 'How many different values can 4 bits take?', options: ['8', '16', '4'], correct: 1, feedback: '2^4 = 16.' },
    },
    {
      id: 'binary_prefix', name: 'Prefix length and network bits', level: 1, prior: 0.60,
      desc: 'In CIDR notation /n means the first n bits identify the network.', prereqs: [],
      lesson: {
        explain: 'In 192.168.10.0/26 the number 26 counts the leading bits that name the network. The other bits belong to hosts.',
        why: 'Confusing the prefix with the host bits flips the whole calculation.',
        misconception: 'Reading /26 as "26 hosts" or "26 host bits".',
        example: { q: 'In /20, how many bits name the network?', a: '20 bits.' },
      },
      probe: { q: 'In the address block 10.0.0.0/8, the 8 means:', options: ['8 host bits', '8 network bits', '8 hosts'], correct: 1 },
      practice: { q: 'A /24 prefix has how many network bits?', options: ['8', '24', '32'], correct: 1, feedback: 'The number after the slash is the network bits: 24.' },
    },
    {
      id: 'reserved_addr', name: 'Network and broadcast addresses', level: 1, prior: 0.55,
      desc: 'The all-zeros and all-ones host addresses are not assigned to hosts.', prereqs: [],
      lesson: {
        explain: 'In every subnet the first address names the network and the last is the broadcast address. Neither can be given to a host, so usable = total - 2.',
        why: 'Forgetting the two reserved addresses gives the classic off-by-two answer.',
        misconception: 'Subtracting 1, or subtracting nothing.',
        example: { q: 'Usable addresses in a block of 8.', a: '8 - 2 = 6.' },
      },
      probe: { q: 'A subnet has 16 addresses in total. How many can be assigned to hosts?', options: ['16', '15', '14'], correct: 2 },
      practice: { q: 'Which addresses in a subnet cannot be assigned to hosts?', options: ['first and last', 'only the last', 'only the first'], correct: 0, feedback: 'Network (first) and broadcast (last) addresses are reserved.' },
    },
    {
      id: 'host_bits', name: 'Host bits = 32 - prefix', level: 2, prior: 0.60,
      desc: 'An IPv4 address has 32 bits; whatever the prefix does not use is left for hosts.',
      prereqs: [['binary_prefix', 0.9, 'Host bits are the bits left after the network bits.']],
      lesson: {
        explain: 'IPv4 addresses have 32 bits. If n are network bits then 32 - n are host bits.',
        why: 'The exponent in the host count is the number of host bits.',
        misconception: 'Using the prefix itself as the exponent.',
        example: { q: 'Host bits in a /27.', a: '32 - 27 = 5.' },
      },
      probe: { q: 'How many host bits does a /20 network have?', options: ['20', '12', '10'], correct: 1 },
      practice: { q: 'Host bits in a /29 are:', options: ['29', '3', '5'], correct: 1, feedback: '32 - 29 = 3.' },
    },
    {
      id: 'usable_hosts', name: 'Usable hosts in a subnet', level: 3, prior: 0.50,
      desc: 'Usable hosts = 2^(32 - prefix) - 2.',
      prereqs: [
        ['host_bits', 0.9, 'The exponent is the host-bit count.'],
        ['powers_of_two', 0.7, 'The total addresses is a power of two.'],
        ['reserved_addr', 0.85, 'Two addresses are removed from the total.'],
      ],
      lesson: {
        explain: 'Compute the host bits h = 32 - prefix, the total addresses 2^h, then subtract the two reserved addresses.',
        why: 'It is a standard GATE networking calculation and each step hides a distinct trap.',
        misconception: 'Giving 2^h as the answer.',
        example: { q: 'Usable hosts in a /28.', a: 'h = 4, 2^4 = 16, 16 - 2 = 14.' },
      },
      probe: { q: 'The usable host count in a /30 subnet is:', options: ['4', '2', '30'], correct: 1 },
      practice: { q: 'Usable hosts in a /27 subnet:', options: ['32', '30', '27'], correct: 1, feedback: 'h = 5, 2^5 = 32, usable = 30.' },
    },
  ];

  function hostsPatterns(p) {
    const h = 32 - p;
    return [
      { value: Math.pow(2, h), cat: 'PREREQUISITE_GAP', concept: 'reserved_addr', evidence: 'The total number of addresses was given: the network and broadcast addresses were not removed.' },
      { value: Math.pow(2, h + 1) - 2, cat: 'PROCEDURAL_ERROR', concept: 'host_bits', evidence: 'The exponent is one too large: the host-bit count was miscalculated.' },
      { value: Math.pow(2, h - 1) - 2, cat: 'PROCEDURAL_ERROR', concept: 'host_bits', evidence: 'The exponent is one too small: the host-bit count was miscalculated.' },
      { value: h, cat: 'PREREQUISITE_GAP', concept: 'powers_of_two', evidence: 'The number of host bits was given, but 2^h was never taken.' },
      { value: Math.pow(2, p) - 2, cat: 'PREREQUISITE_GAP', concept: 'binary_prefix', evidence: 'The prefix length was used as the number of host bits.' },
      { value: Math.pow(2, h) - 1, cat: 'PREREQUISITE_GAP', concept: 'reserved_addr', evidence: 'Only one reserved address was subtracted instead of two.' },
    ];
  }
  const dedupe = (pats, answer) => {
    const seen = new Set([answer]);
    return pats.filter((x) => (seen.has(x.value) ? false : seen.add(x.value)));
  };

  const mk = (statement, p) => {
    const h = 32 - p;
    const value = Math.pow(2, h) - 2;
    return {
      statement,
      answer: { kind: 'number', value, unit: '', tolPct: 0, exact: true, display: String(value) },
      solution: ['Host bits = 32 - ' + p + ' = ' + h, 'Total addresses = 2^' + h + ' = ' + Math.pow(2, h), 'Usable = ' + Math.pow(2, h) + ' - 2 = ' + value],
      setup: [], unitSensitive: false,
      patterns: dedupe(hostsPatterns(p), value),
      keywords: [],
    };
  };

  const problems = [{
    id: 'subnet-hosts-26',
    title: 'Usable hosts in 192.168.10.0/26',
    target: 'usable_hosts',
    difficulty: 'Core',
    gen() {
      return mk('An organisation is allocated the network 192.168.10.0/26. How many usable host addresses does each subnet of this size contain?', 26);
    },
  }];

  const verification = [
    {
      id: 'subnet-verify-a',
      title: 'Fresh subnet: a /24-/29 block',
      gen(rng) {
        const p = rng.pick([25, 27, 28, 29]);
        const third = rng.int(0, 200);
        return mk('A router interface is configured with 172.16.' + third + '.0/' + p + '. How many hosts can be assigned unique addresses on this link?', p);
      },
    },
    {
      id: 'subnet-verify-b',
      title: 'Fresh subnet: a large block',
      gen(rng) {
        const p = rng.pick([20, 22, 23]);
        return mk('A campus network uses 10.4.0.0/' + p + ' on a single VLAN. How many devices can be given an address in this VLAN?', p);
      },
    },
  ];

  MT.data.register({
    id: 'gate-subnet', domainId: 'gate-cs', exam: 'GATE CS', subject: 'Computer Networks', topic: 'IP addressing',
    blurb: 'Prefix length, host bits and the two addresses you cannot use.',
    target: 'usable_hosts', concepts, problems, verification,
  });
})(typeof window !== 'undefined' ? window : globalThis);
