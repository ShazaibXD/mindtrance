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

- **Diagnosis, not chat.** Deterministic answer checking, then one of eleven outcomes (conceptual or prerequisite gap, procedural error, calculation or unit slip, reading slip, possible slip, partial understanding, not enough evidence and more) with the evidence shown and a transparent evidence score.
- **Prerequisite tracing.** Candidate causes are ranked through a DAG by dependency strength and mastery history, not by proximity alone.
- **Suspected vs confirmed.** A weighted evidence score decides: below 0.45 the app asks a question first, 0.45 to 0.75 it shares a hypothesis and checks it, 0.75 or more (your own working shows the error) it confirms with no probe. At most two probes per question, then a worked solution and a spaced review.
- **Recovery and verification.** Short lesson with the named misconception, a worked example, a practice question, then a fresh generated problem. The original problem stays locked until the gap is verified fixed.
- **Bayesian Knowledge Tracing.** Observations and learning transitions are separate, so a wrong answer can never raise mastery.
- **Knowledge gap map.** Interactive SVG graph: pan, zoom, fit, dependency highlighting, concept panel, recovery action, keyboard support, and a table alternative.
- **Progress analytics.** Mastery over time, attempts, correctness trend, recovery success, repeated misconceptions, weakest concepts.
- **Safe parsing.** Numbers, units and algebraic expressions are parsed by a hand-written parser (no `eval`) and compared numerically.
- **Seven learning modes.** Solve with me, check my answer, find out why I keep getting it wrong, give me a hint (three levels, no penalty), explain this concept, teach me from the basics, exam prep. The last three of the first group need no attempt.
- **Honest learner model.** Not assessed, learning in progress, ready to reassess, provisionally mastered (two observations needed). Estimates fade toward the starting assumption if you stop practising, open-ended work is scored on a rubric track, and verified concepts come back for spaced review.
- **Ask anything.** Type a question from any subject, no subject picker. With your own Gemini key MINDTRACE builds a prerequisite map for it, judges your open-ended answer, asks a targeted follow-up when the evidence is weak, and verifies learning with a fresh question that is checked deterministically. A scripted history question works with no key.
- **Seven tracks** across JEE Physics, JEE Chemistry, JEE Mathematics, NEET Biology, GATE CS and first-year engineering (EEE and CSE), defined as data.
- **Judge demo mode**, light and dark themes, responsive layout, optional Gemini classification.
- **Motion and design.** Smooth scrolling with [Lenis](https://github.com/darkroomengineering/lenis), scroll-driven reveals, a scrubbed timeline and count-ups with [GSAP](https://github.com/greensock/GSAP), an animated node-and-edge hero from [Vanta](https://github.com/tengbao/vanta), and spotlight cards, split-text, magnetic buttons and a marquee in the spirit of [react-bits](https://github.com/DavidHDev/react-bits), re-written in plain JavaScript. Everything switches off under `prefers-reduced-motion`, and without WebGL the page falls back to a plain background.

## What is real and what is not

| Area | Status |
| --- | --- |
| Diagnosis engine | Rule-based and deterministic. Every result is labelled with the engine that produced it. |
| Gemini integration | Optional, bring your own key in Settings. Used for (1) classifying unrecognised answers, (2) building maps for questions you ask, (3) judging open-ended answers. All schema-validated, unit-tested and e2e-tested with a mocked Google endpoint. **Never exercised against the live API.** |
| Open-ended answers | Judged by Gemini or, for the demo question only, a keyword rubric. This is an AI judgement and is labelled as one everywhere. It is not a verified result. |
| Generated maps | Written by Gemini, validated for structure, **not reviewed by a person**. Can be wrong. |
| Accounts | Local profiles in `localStorage`, no password. **Not real authentication.** |
| Database | None. Data lives in the browser. A Supabase schema is proposed in `docs/DATABASE.md` but not implemented. |
| Content | 7 hand-authored tracks (39 concepts, 8 original problems, 14 fresh-problem generators). A seed for the format, not a syllabus. |
| Mastery values | Transparent estimates with uncalibrated parameters. Not grades. |

## Specification alignment

`docs/SPEC_ALIGNMENT.md` maps every section of the "Universal AI Learning Diagnostic System" specification to what is implemented, adapted, partial or missing in this browser app.

## Deviations from the original brief

The original brief specified Next.js, FastAPI, SymPy, KaTeX, React Flow and Supabase. The requirement for this build was plain HTML, CSS and JS that opens as a webpage, so those were replaced. See `docs/ARCHITECTURE.md` for the mapping.

## Technology

Vanilla JavaScript (classic scripts, so `file://` works), SVG for the graph and charts, `localStorage` for persistence, Node's built-in test runner for unit tests and Playwright for end-to-end tests. Fonts (Inter, Fraunces, JetBrains Mono) load from Google Fonts and fall back to system fonts offline. Third-party motion libraries are vendored in `vendor/`, so the site stays static, works from `file://` and keeps the same-origin Content-Security-Policy.

## Prerequisites

- A current browser.
- Node 20 or newer, only to run tests. End-to-end tests also need Google Chrome (or `npx playwright install chromium`).
- Python 3 only if you want `npm run serve`.

## Environment configuration

There are no required environment variables and no `.env` files. The optional Gemini key is entered in the app (Settings) and stored in your browser.

## Running tests

```bash
npm test               # 198 unit and smoke tests, no install needed
npm install            # once, for Playwright
npm run test:e2e       # 59 browser tests driving the real UI
```

The unit suite covers the engine, content, state machine, store, flow, analytics, UI helpers, graph rendering and three headless-Chrome smoke tests (skipped when Chrome is not installed; set `CHROME_BIN` to point at a browser). The e2e suite clicks through the whole student journey. See `docs/TESTING.md`.

## Ask anything

1. Open **Ask anything** in the sidebar.
2. Without a key: click **Open the demo question**. It is a history essay question with a pre-written map. Answers are graded by a keyword rubric (labelled "not AI"). Try a weak answer such as "The treaty was unfair to Germany." to see the follow-up question, then follow the loop.
3. With a key: add it in Settings, type any question and click **Build my learning map**. Your answer is judged by Gemini.

Your own questions are stored per profile and can be deleted from the same page.

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
css/                tokens, base, components, pages, landing
vendor/             Lenis, GSAP, ScrollTrigger, Vanta, three.js (copied by `npm run vendor`, licences in vendor/LICENSES.md)
js/core/            bkt, expr, graph, diagnose, machine, rng, ai (pure logic, runs in Node)
js/custom.js        validation and building of maps for student-asked questions, plus the demo fixture
js/core/adapters.js subject adapters; js/core/safety.js prompt-injection and evidence-quote checks
js/data/            registry and one file per knowledge track
js/store.js         profiles, mastery, events, sessions (localStorage)
js/flow.js          attempt, probe, recovery and verification orchestration
js/analytics.js     progress calculations
js/ui/              router, shell, motion layer, graph view, charts, stage panels, pages/
tests/              node:test suites; tests/e2e has the Playwright specs
docs/               architecture, API, database, testing, deployment, progress, roadmap
```

## Adding a track

Create a file in `js/data/` that calls `MT.data.register({...})` with concepts, prerequisite edges, problems (with error signatures) and verification generators, add it to `index.html` and `tests/load.js`. The content tests validate the graph, learning content, and every error signature automatically.

## Troubleshooting

- **Blank page or old behaviour after an update:** hard reload (Cmd/Ctrl+Shift+R). Scripts are cached by the browser.
- **Progress disappeared:** progress is stored per browser profile. Clearing site data, private windows, or a different browser start fresh. Use Settings, Export as JSON, to keep a copy.
- **No animated background:** the Vanta network needs WebGL and is skipped under reduced motion or on devices without it. That is expected.
- **Fonts look different offline:** the system font stack is used as a fallback.
- **Gemini says the key was rejected:** check the key and that it is allowed to call the Generative Language API. The rule-based result is always used as the fallback.
- **Smoke tests skipped:** install Chrome or set `CHROME_BIN`.
- **e2e cannot launch Chrome:** run `npx playwright install chromium` and then `E2E_CHANNEL=chromium npm run test:e2e`.

## Deployment

Any static host works. See `docs/DEPLOYMENT.md`. Nothing has been deployed publicly.

## Licence

MIT
