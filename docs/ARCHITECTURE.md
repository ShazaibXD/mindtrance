# MINDTRACE architecture

MINDTRACE is a static web app: open `index.html` in a browser (or serve the folder) and it runs. There is no build step and no runtime dependency.

## Deviation from the original spec

The original brief asked for Next.js, FastAPI, Supabase and Gemini. For this hackathon prototype the requirement is plain HTML, CSS and JS that opens as a webpage, so the architecture is reshaped:

| Spec item | Prototype implementation |
| --- | --- |
| Next.js + React | Vanilla JS, hash router, template-string views |
| React Flow | Custom SVG graph with pan, zoom, fit, selection |
| KaTeX | Small sub/superscript formatter (`js/ui/math.js`) |
| FastAPI + Pydantic | Pure JS modules in `js/core` with explicit validators |
| SymPy | Safe expression parser and numeric equivalence checker (`js/core/expr.js`), no `eval` |
| Supabase auth + DB | Local profiles and `localStorage` persistence (not real auth) |
| Gemini structured output | Optional browser-side call with schema validation (`js/core/ai.js`) |

## Layers

```
js/core    pure logic, no DOM, runs in Node for tests
  bkt.js       Bayesian Knowledge Tracing
  expr.js      safe number/unit/expression parsing and checking
  graph.js     prerequisite DAG validation, traversal, suspect ranking, layout
  diagnose.js  rule-based error classification
  machine.js   diagnostic session state machine
  verify.js    fresh verification problem selection
  rng.js       seeded random numbers for reproducible generated problems
  ai.js        optional Gemini classifier with validation
js/data    registry plus one file per knowledge track (concepts, edges, problems, generators)
js/store.js      persistence, mastery, events, sessions (localStorage)
js/flow.js       attempt, probe, recovery and verification orchestration
js/analytics.js  progress calculations
js/ui      router (app.js), shell, graph view, charts, stage panels, pages/
css        design tokens, base, components, pages
tests      node:test suites (incl. headless Chrome smoke tests)
```

Core modules are written as dual-environment scripts: they attach to `window.MT` in the browser and `globalThis.MT` plus `module.exports` in Node. Classic scripts (not ES modules) are used so that opening `index.html` from `file://` works.

## Diagnostic flow

1. Parse the attempt (answer + working).
2. `diagnose.classify` checks the answer against the problem's known error signatures, power-of-ten and sign slips, and working-step keywords.
3. `graph.rankSuspects` ranks upstream concepts by dependency strength, current mastery and depth. The nearest prerequisite is not blindly blamed.
4. A micro-probe on the top suspect confirms or rejects the hypothesis. A suspect is only a gap once a probe fails and BKT mastery drops below the gap threshold.
5. Recovery lesson, practice, fresh verification problem. Learning transitions are applied only after a recovery intervention.

## Honesty rules

The default engine is deterministic and rule-based. The UI labels which engine produced each diagnosis. Mastery values are transparent BKT estimates, not calibrated measurements.

## State machine

```
READY -> ATTEMPT_SUBMITTED -> ATTEMPT_CORRECT -> READY
                           -> ERROR_CLASSIFIED -> RETRY_REQUIRED (slip, unit error, no gap found)
                                               -> PROBE_REQUIRED -> PROBE_REQUIRED (next hypothesis)
                                                                 -> RETRY_REQUIRED (no gap confirmed)
                                                                 -> GAP_CONFIRMED -> RECOVERY_REQUIRED -> RECOVERY_IN_PROGRESS
                                                                                     ^                     |
                                                                                     |                     v
                                                                  (same gap again) +---- VERIFICATION_REQUIRED -> MASTERY_VERIFIED -> RETRY_REQUIRED -> READY
READY -> RECOVERY_REQUIRED   (recovery started from the knowledge map)
```

Illegal transitions throw. Sessions are persisted after every step, so a refresh resumes in the same state.

## Mastery rules

- Observations (probe, practice and verification answers, attempts) use the BKT posterior only.
- The learning transition P(T) is applied exactly once per recovery, when the lesson is completed.
- A careless slip or a single unit error changes no mastery.
- Thresholds: mastered at 0.80 or above, confirmed gap below 0.45 and only with at least one missed answer on the concept, otherwise needs verification.
- A failed probe confirms a gap only if the posterior falls below 0.45. A strong prior can survive one miss, in which case the next hypothesis is probed.
- Verification succeeds only when the estimate reaches 0.80; otherwise another fresh problem is issued.
