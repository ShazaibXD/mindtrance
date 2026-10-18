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
| Gemini structured output | Optional browser-side calls with schema validation (`js/core/ai.js`): classify, build a map for any question, judge an open-ended answer |

## Layers

```
js/core    pure logic, no DOM, runs in Node (adapters.js and safety.js are new) for tests
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

## Universal input (Ask anything)

The three priorities from the product brief and how each is met:

1. **Universal input.** `MT.ai.generateTrack` asks Gemini for a prerequisite map in a strict schema (4 to 6 concepts, one level 3 target, lesson, probe, practice and two fresh questions per concept). The schema extends the original `generate-track` endpoint of the uploaded backend to non-STEM content. `MT.custom.validateSpec` rejects anything malformed: bad ids, duplicate or unknown prerequisites, cycles, unreachable concepts, wrong option counts, out-of-range values. A valid spec is stored per profile and rebuilt by `MT.custom.buildTrack` into the same track shape as built-in content, so the map, workspace, dashboard and analytics work unchanged.
2. **Evidence-based diagnosis.** Open-ended answers have no deterministic checker, so `MT.ai.judgeOpen` returns a verdict (correct or not, category, suspected concept, confidence, evidence). Every concept id is validated against the graph. Whenever the evidence strength is below 60%, the probe is presented as an explicit follow-up ("Not sure yet") and nothing is taught until it is answered. This applies to built-in tracks too.
3. **Verified learning.** The fresh question is multiple choice and tagged with the concept being recovered, so it is graded deterministically and updates mastery through the same BKT rules. Verification is never decided by the model.

Answer kinds: `number` and `expr` (deterministic), `choice` (deterministic, used for fresh questions on custom maps), `open` (needs a judgement from Gemini or the demo rubric; the result carries `engine` and is labelled in the UI).

The demo fixture is a hand-written map and a keyword rubric for one history question. It exists so the whole loop can be shown without a key, and is labelled as scripted wherever it appears.

## Diagnosis policy (spec alignment)

1. **Classify.** `MT.diagnose.classify` returns an outcome (one of 11, see `OUTCOMES`) plus a list of weighted evidence items.
2. **Score.** `S_E = 1 - product(1 - w * r)`. Tiers: below 0.45 insufficient, 0.45 to 0.75 suspected, 0.75 or more confirmed.
3. **Route** (`flow.settle`): slips and language difficulty retry with no mastery change; confirmed gaps go straight to recovery; everything else gets at most two probes; two probes without a cause, or two failed recoveries, escalate to a worked solution and schedule spaced reviews.
4. **Update.** BKT observations use format-adjusted guess rates. The recovery lesson applies P(T) = 0.30 once. Open-ended answers on rubric-type subjects update the rubric accumulator instead. Estimates decay toward the prior with a half-life that doubles on each spaced verification.

Other session paths: `DIRECT_EXPLANATION` (explain and teach-from-basics, no questions first), `REASONING_CHECK` (right answer, no reasoning shown). See `docs/SPEC_ALIGNMENT.md` for the full mapping.
