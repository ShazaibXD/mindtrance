# MINDTRACE

**Find the gap. Fix the foundation.**

MINDTRACE is a learning diagnostic prototype. When a student gets a problem wrong it asks *why*: a careless slip, a unit error, or a missing prerequisite. It tests the suspected cause with a short probe before teaching anything, then verifies the fix on a fresh problem and updates a visual knowledge graph.

It is a static web app (HTML, CSS and plain JavaScript). Open `index.html` in a browser and it runs. No build step, no server, no account.

## Quick start

```bash
git clone https://github.com/ShazaibXD/mindtrance.git
cd mindtrance
open index.html          # macOS; or double-click index.html, or:
npm run serve            # http://localhost:4173
```

Then click **Judge demo** on the landing page for a guided run of the whole loop.

## Features

- **Diagnosis, not chat.** Deterministic answer checking, then a category with the evidence shown: careless slip, unit error, prerequisite gap or concept misconception.
- **Prerequisite tracing.** Candidate causes are ranked through a DAG by dependency strength and mastery history, not by proximity alone.
- **Suspected vs confirmed.** A suspect becomes a confirmed gap only after a failed probe pushes the Bayesian estimate below 0.45.
- **Recovery and verification.** Short lesson with the named misconception, a worked example, a practice question, then a fresh generated problem. The original problem stays locked until the gap is verified fixed.
- **Bayesian Knowledge Tracing.** Observations and learning transitions are separate, so a wrong answer can never raise mastery.
- **Knowledge gap map.** Interactive SVG graph: pan, zoom, fit, dependency highlighting, concept panel, recovery action, keyboard support, and a table alternative.
- **Progress analytics.** Mastery over time, attempts, correctness trend, recovery success, repeated misconceptions, weakest concepts.
- **Safe parsing.** Numbers, units and algebraic expressions are parsed by a hand-written parser (no `eval`) and compared numerically.
- **Six tracks** across JEE Physics, JEE Chemistry, JEE Mathematics, NEET Biology, GATE CS and first-year EEE, defined as data.
- **Judge demo mode**, light and dark themes, responsive layout, optional Gemini classification.

## What is real and what is not

| Area | Status |
| --- | --- |
| Diagnosis engine | Rule-based and deterministic. Every result is labelled with the engine that produced it. |
| Gemini integration | Optional, bring your own key in Settings. Schema-validated and unit-tested with mocked responses. **Not exercised against the live API.** |
| Accounts | Local profiles in `localStorage`, no password. **Not real authentication.** |
| Database | None. Data lives in the browser. A Supabase schema is proposed in `docs/DATABASE.md` but not implemented. |
| Content | 6 hand-authored tracks (33 concepts, 7 original problems, 12 fresh-problem generators). A seed for the format, not a syllabus. |
| Mastery values | Transparent estimates with uncalibrated parameters. Not grades. |

## Deviations from the original brief

The original brief specified Next.js, FastAPI, SymPy, KaTeX, React Flow and Supabase. The requirement for this build was plain HTML, CSS and JS that opens as a webpage, so those were replaced. See `docs/ARCHITECTURE.md` for the mapping.

## Technology

Vanilla JavaScript (classic scripts, so `file://` works), SVG for the graph and charts, `localStorage` for persistence, Node's built-in test runner for tests. Fonts (Inter, Fraunces, JetBrains Mono) load from Google Fonts and fall back to system fonts offline.

## Prerequisites

- A current browser.
- Node 20 or newer, only to run tests.
- Python 3 only if you want `npm run serve`.

## Environment configuration

There are no required environment variables and no `.env` files. The optional Gemini key is entered in the app (Settings) and stored in your browser.

## Running tests

```bash
npm test
```

122 tests across the engine, content, state machine, store, flow, analytics, UI helpers, graph rendering and three headless-Chrome smoke tests (skipped automatically when Chrome is not installed; set `CHROME_BIN` to point at a browser). See `docs/TESTING.md`.

## Demo mode

1. Click **Judge demo** on the landing page. A profile named "Judge demo" is created.
2. In the workspace, click **Fill in the demo wrong attempt** and submit. The answer is a pre-written fixture; the diagnosis is computed live.
3. Read the diagnosis and evidence, then answer the probe wrongly (the option an inverted ratio gives).
4. Start recovery, read the lesson, answer practice, then solve the fresh verification problem(s).
5. Watch mastery and the graph update (**Gap map**), then retry the original problem.

Use **Reset demo data** in the guide panel to start over.

## Project layout

```
index.html          entry point
css/                tokens, base, components, pages
js/core/            bkt, expr, graph, diagnose, machine, rng, ai (pure logic, runs in Node)
js/data/            registry and one file per knowledge track
js/store.js         profiles, mastery, events, sessions (localStorage)
js/flow.js          attempt, probe, recovery and verification orchestration
js/analytics.js     progress calculations
js/ui/              router, shell, graph view, charts, stage panels, pages/
tests/              node:test suites
docs/               architecture, API, database, testing, deployment, progress, roadmap
```

## Adding a track

Create a file in `js/data/` that calls `MT.data.register({...})` with concepts, prerequisite edges, problems (with error signatures) and verification generators, add it to `index.html` and `tests/load.js`. The content tests validate the graph, learning content, and every error signature automatically.

## Troubleshooting

- **Blank page or old behaviour after an update:** hard reload (Cmd/Ctrl+Shift+R). Scripts are cached by the browser.
- **Progress disappeared:** progress is stored per browser profile. Clearing site data, private windows, or a different browser start fresh. Use Settings, Export as JSON, to keep a copy.
- **Fonts look different offline:** the system font stack is used as a fallback.
- **Gemini says the key was rejected:** check the key and that it is allowed to call the Generative Language API. The rule-based result is always used as the fallback.
- **Smoke tests skipped:** install Chrome or set `CHROME_BIN`.

## Deployment

Any static host works. See `docs/DEPLOYMENT.md`. Nothing has been deployed publicly.

## Licence

MIT
