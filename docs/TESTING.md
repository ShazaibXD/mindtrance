# Testing

```bash
npm test        # node --test tests/*.test.js
```

Requires Node 20 or newer. There are no dependencies to install.

## What is covered

| Suite | Covers |
| --- | --- |
| `bkt` | Correct and incorrect observations, learning transition only on request, boundaries, numerical stability, thresholds, invalid parameters |
| `expr` | Number, unit and percent parsing, unit conversion, tolerances, expression equivalence, rejection of unsafe input |
| `graph` | Validation (duplicates, cycles, orphans), ancestors, suspect ranking (nearest parent is not blindly blamed), layout |
| `content` | For every registered track: valid graph, complete lessons, probes and practice, error signatures, 8 seeds of every verification generator |
| `answers` | Worked answers of every original problem; verification answers recomputed from first principles |
| `diagnose` | Every known error signature classifies to its declared category and concept; slips, unit errors, sign flips, percentages, fallbacks, invalid input, invalid concept ids |
| `machine` | Legal and illegal transitions, no path to verified mastery that skips recovery |
| `store` | Profiles, isolation, persistence across instances, corrupt storage, evidence vs prior, blocked and suspected states, settings migration |
| `flow` | The full acceptance journey (wrong attempt to verified mastery, locked retry, persistence), slips, rejected hypotheses, failed verification, map-started recovery, unit-error escalation, every track end to end |
| `ai` | Schema validation, key handling, timeouts, friendly errors, override rules (all with mocked fetch) |
| `analytics`, `ui-util`, `graphview` | Pure analytics, escaping and math formatting, graph markup, accessibility attributes |
| `smoke` | Headless Chrome loads `index.html` from `file://`: landing, graph, six domains, route guard, not-found |

## What is not covered

- No automated DOM interaction tests (clicking through the workspace). The full journey was exercised by hand in a browser during development, and the logic behind it is covered by the `flow` suite. A Playwright suite is on the roadmap.
- The Gemini integration has only been tested against mocked responses, never the live API.
- Accessibility has had a keyboard and semantics pass but no automated audit and no screen reader test.
- No cross-browser testing beyond Chrome.

Real external services are never required to run the tests.
