# Testing

```bash
npm test             # unit and smoke tests: node --test tests/*.test.js (205 tests, no install)
npm run test:e2e     # Playwright browser tests (65 tests)
```

Unit tests need Node 20 or newer and nothing else. The e2e suite needs `npm install` once and uses the Google Chrome already on the machine (`channel: 'chrome'`), so no browser is downloaded. To use Playwright's own Chromium instead: `npx playwright install chromium` then `E2E_CHANNEL=chromium npm run test:e2e`. The suite starts its own dependency-free static server on port 4174.

## What is covered

| Suite | Covers |
| --- | --- |
| `bkt` | Correct and incorrect observations, learning transition only on request, boundaries, numerical stability, thresholds, invalid parameters |
| `expr` | Number, unit and percent parsing, unit conversion, tolerances, expression equivalence, rejection of unsafe input |
| `graph` | Validation (duplicates, cycles, orphans), ancestors, suspect ranking (nearest parent is not blindly blamed), layout |
| `content` | For every registered track: valid graph, complete lessons, probes and practice, error signatures, 8 seeds of every verification generator |
| `answers` | Worked answers of every original problem; verification answers recomputed from first principles |
| `diagnose` | The composite evidence score and its three tiers, history evidence, possible-slip detection, bare versus shown working, every known error signature classifies to its declared category and concept; slips, unit errors, sign flips, percentages, fallbacks, invalid input, invalid concept ids |
| `machine` | Legal and illegal transitions, no path to verified mastery that skips recovery |
| `store` | Profiles, isolation, persistence across instances, corrupt storage, evidence vs prior, blocked and suspected states, settings migration |
| `flow` | The full acceptance journey (wrong attempt to verified mastery, locked retry, persistence), slips, rejected hypotheses, failed verification, map-started recovery, unit-error escalation, every track end to end |
| `ai` | Schema validation, key handling, timeouts, friendly errors, override rules (all with mocked fetch) |
| `custom` | Spec validation (15 malformed variants rejected), control-character cleaning, track building, mocked Gemini generation and judging (key never in URL, rate limits, bad JSON, unknown concept ids), demo rubric, open-ended and choice answers, the full open-ended journey with a follow-up and concept-targeted fresh question, per-profile privacy and deletion |
| `motion` (unit) | Count-up formatting, and that motion is never enabled outside a browser |
| `safety`, `adapters` | Hidden-character and injection flagging, exact-substring evidence quotes, judgemental-wording rejection, bare-answer confidence cap, the full outcome enum, domain guidance in prompts, adapter selection, honest verifier availability, estimator choice |
| `tour` (unit) | Each session state maps to one numbered step, text uses the session's real numbers, tour titles never clash with the page's own headings, the panel is escaped, off-path states get a restart |
| `modes` | Learning modes, three-level hints without mastery change, explanation and teach-from-basics order, reasoning check for a right answer, spec example of flawed reasoning |
| `analytics`, `ui-util`, `graphview` | Pure analytics, escaping and math formatting, graph markup, accessibility attributes |
| `smoke` | Headless Chrome loads `index.html` from `file://`: landing, graph, six domains, route guard, not-found |

## End-to-end suite (`tests/e2e`)

| Spec | Covers |
| --- | --- |
| `journey` | The acceptance scenario through real clicks: wrong attempt, diagnosis with evidence and no answer leak, failed probe, confirmed gap, blocked target, personalised lesson, practice, fresh verification, mastery update, graph update, retry, refresh persistence. Also: locked retry, failed verification returning to the lesson, slip handling with no mastery change, inline rejection of unreadable answers |
| `map` | Node selection, dependency highlighting, zoom and fit, drag to pan without selecting, keyboard selection, recovery from the map, table alternative, switching topic |
| `app` | Route guard and sign-up validation, sign out and back in, markup in names shown as text, honest empty states, settings (rename, theme persistence, confirmed reset), export excludes the API key, explorer filter |
| `tracks` | For all 7 tracks: a typical wrong answer produces the expected hypothesis and probe, and the correct answer is accepted |
| `ask` | No-key state and labelled fixture; the complete universal loop on the demo question through real clicks; vague answers give low-confidence follow-ups; with a key, using a **mocked Google endpoint**: map built from a typed question, answer judged, key only in a header, rate-limited and malformed generations rejected with nothing saved, a judgement naming an unknown concept rejected |
| `modes` | Hints, explain and teach-from-basics, the reasoning check, dotted uncertain edges, clarification before any request is sent |
| `motion` | Motion enabled: smooth scroll, split-text with a correct accessible label, Vanta canvas mounts and is released off screen, scroll reveals, theme switch re-colours the network, no WebGL fallback, the full diagnostic loop while pages animate, entrance animations leave nodes opaque and edges undashed, graph zoom not hijacked. Reduced motion: nothing animates and everything is visible. The rest of the suite runs with `reducedMotion: 'reduce'` so animations cannot cause flakiness |
| `tour` | A first-time visitor finishes all nine steps using only the tour's own buttons and text, the tour can be hidden and shown, the working-shown path skips the question, the seven modes are tucked away during the demo but not on other problems, and a normal profile never sees the tour |
| `guide` | A new profile sees the four first-run steps; the How it works page lists the words and status legend; a page intro can be hidden, stays hidden after reload, and can be brought back; the map shows a colour key and keeps the graph in the first screen |
| `mobile` | 375px width: no horizontal overflow on any page, navigation drawer, the loop works with touch |

The generated verification answer is read from app state (`MT.flow.verificationProblem`), because a test cannot guess random numbers. Everything else is done through the UI.

## What is not covered

- The Gemini integration (classification, map generation, answer judging) has only been tested against mocked responses, never the live API. The mocks follow the documented request and response shape, so a real model may still return output that the validators reject.
- Accessibility has had a keyboard and semantics pass but no automated audit and no screen reader test.
- No cross-browser testing beyond Chrome. The Playwright config can be extended with Firefox and WebKit projects.

Real external services are never required to run the tests.
