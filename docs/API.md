# Core module API

The original brief called for a versioned REST API. This build is client-side only, so the equivalent contract is the set of pure JavaScript modules below. All of them are loaded in Node by `tests/load.js` and are covered by tests. Everything hangs off the global `MT`.

| Brief endpoint | Equivalent here |
| --- | --- |
| `GET /domains`, `/domains/{id}/tracks`, `/tracks/{id}` | `MT.data.domains`, `MT.data.tracksFor(id)`, `MT.data.track(id)` |
| `POST /attempts` + `/diagnose` | `MT.flow.submitAttempt(store, sessionId, answer, working, opts)` |
| `POST /diagnoses/{id}/probe` | `MT.flow.currentProbe(session)`, `MT.flow.answerProbe(store, sessionId, optionIndex)` |
| `POST /recoveries` | `MT.flow.beginRecovery`, `completeLesson`, `answerPractice` |
| `POST /recoveries/{id}/verify` | `MT.flow.startVerification`, `MT.flow.submitVerification` |
| `GET /knowledge-graph` | `store.graphState(trackId)` |
| `GET /mastery` | `store.record(trackId, conceptId)`, `store.masteryMap(trackId)` |
| `GET /progress` | `MT.analytics.*` |
| `GET /history` | `store.events()`, `store.sessionList()` |

## MT.bkt

- `observe(prior, correct, params?)` returns `{ before, posterior, after }`. Never applies learning.
- `learn(prior, params?)` applies the learning transition. Call only after a recovery intervention.
- `status(p, params?)` returns `MASTERED` (>= 0.80), `NEEDS_VERIFICATION` (0.45 to below 0.80) or `CONFIRMED_GAP` (below 0.45).
- `validateParams` throws `RangeError` for invalid probabilities. Defaults: slip 0.10, guess 0.20, transit 0.25.

## MT.expr

- `parseAnswer(text)` returns `{ ok, value, unit, percent }` or `{ ok:false, reason }`.
- `valueIn(parsed, unit)` converts to the expected unit or reports a dimension mismatch.
- `exprEquivalent(a, b)` compares two expressions in `x` by numeric sampling. No `eval`.

## MT.graph

`validate(track)` (duplicates, unknown ids, bad weights, cycles, unreachable concepts), `ancestors`, `descendants`, `topoOrder`, `rankSuspects(graph, targetId, mastery, { hints, includeTarget })`, `blockedBy`, `layout`.

## MT.diagnose

- `classify(track, problem, answer, working)` returns `{ category, confidence, evidence[], hintConcept, matchedBy, engine }`. Categories: `CORRECT`, `CARELESS_SLIP`, `UNIT_ERROR`, `PREREQUISITE_GAP`, `CONCEPT_MISCONCEPTION`, plus `INVALID_INPUT` for unreadable answers.
- `diagnose(...)` adds ranked `candidates[]`. Concept ids are checked against the graph.
- `matchedBy` is one of `verified`, `signature`, `generic`, `working`, `setup`, `fallback`, `ai`.

## MT.machine

`STATES`, `TRANSITIONS`, `canTransition(from, to)`, `transition(session, to, note)` which throws `IllegalTransition` for anything not listed. See `docs/ARCHITECTURE.md` for the diagram.

## MT.ai

`validate(raw, track)` strictly validates a model response. `classify(cfg, track, problem, answer, working)` calls Gemini with the key in an `x-goog-api-key` header, a timeout, and friendly error messages that never contain the key.

## MT.custom

`validateSpec(raw)` returns `{ ok, spec }` or `{ ok:false, error }`. `buildTrack({ id, spec, question, source })` returns a normal track (`custom: true`, one open-ended problem, concept-tagged `choice` verification templates). `makeId(question)`, `FIXTURE` (the demo question and map), `fixtureJudge(answer)` (scripted rubric, engine `demo-rubric`).

## MT.ai (additions)

`generateTrack(cfg, question)` returns a validated spec. `judgeOpen(cfg, track, question, answer, working)` returns `{ engine, isCorrect, category, confidence, hintConcept, evidence[] }`. `callGemini` is the single network helper (key in `x-goog-api-key` header, timeout, friendly errors).

## MT.store

`create({ storage?, now? })`. Custom questions: `addCustomTrack({ question, spec, source })`, `removeCustomTrack(id)`, `customTracks()`. Profiles (`signUp`, `signIn`, `signOut`, `renameProfile`, `deleteProfile`), mastery (`observe`, `learn`, `conceptState`, `graphState`), sessions (`newSession`, `getSession`, `activeFor`, `sessionList`), `events()`, `settings()`, `exportData()`.
