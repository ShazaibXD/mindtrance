# Progress

Status labels: **Verified** = exercised end to end in a browser, **Tested** = automated tests pass, **Implemented** = code exists but is not independently tested, **Not started**, **Blocked**.

- **Overall completion:** about 90% of the adapted static-prototype scope. About 50% of the original brief as written (Next.js, FastAPI, Supabase and live AI were deliberately replaced; see `docs/ARCHITECTURE.md`).
- **Current phase:** Phase 14, final verification
- **Current task:** documentation and push
- **Tests passing:** 194 / 194 unit and smoke (`npm test`) and 58 / 58 Playwright end-to-end (`npm run test:e2e`), 0 failing
- **Spec alignment:** see `docs/SPEC_ALIGNMENT.md`
- **Latest commit before this file was updated:** `d569cd1`
- **Blockers:** none for the prototype. Live Gemini testing needs an API key. Real auth and database need a Supabase project.
- **Next recommended task:** a Supabase-backed store behind the same interface, then Firefox and WebKit e2e projects.

## Features

| Feature | Status |
| --- | --- |
| BKT mastery engine (observations separate from learning) | Tested |
| Safe number, unit and expression parsing | Tested |
| Prerequisite graph validation, traversal, suspect ranking | Tested |
| Rule-based diagnosis, every error signature | Tested |
| Diagnostic state machine | Tested |
| Probe, recovery, fresh verification, mastery update flow | Tested, Verified end-to-end in browser (EEE track, demo path) |
| Persistence across refresh | Tested, Verified in browser |
| Seven content tracks (incl. first-year CSE) | Tested (graph, content, every signature, all verification generators); loop covered per track in `flow` tests; wrong and correct answers exercised per track in e2e |
| Full student journey through the real UI | Verified end-to-end by the Playwright suite (36 tests, Chrome) |
| Landing, auth, dashboard, workspace, map, progress, explorer, settings | Verified in browser (all routes render, mobile has no horizontal overflow) |
| Knowledge gap map interactions (select, highlight, zoom) | Verified in browser |
| Keyboard operation of graph and forms | Implemented (not audited) |
| Light and dark theme | Verified visually |
| Content-Security-Policy, escaping of user text | Verified (XSS attempt rendered as text) |
| Opens from `file://` | Verified in headless Chrome (smoke test) |
| Optional Gemini classification | Tested with mocks only. **Not verified against the live API.** |
| Ask anything: map from any question, open-ended answer judging, follow-up question, concept-targeted fresh question | Tested (unit and e2e) with mocked Gemini; the keyless demo fixture is Verified end-to-end. **Live Gemini output quality is unverified** |
| Judge demo mode | Verified in browser |
| Visual redesign and motion (Lenis, GSAP, Vanta) | Verified visually in Chrome (dark, light, phone) and by 7 browser tests; screenshots reviewed by hand |
| Spec outcome taxonomy, composite evidence score, two-probe ceiling, escalation, recovery cap | Tested and verified end-to-end in Chrome |
| Learning modes, hints, explanations, reasoning check, clarification | Tested and verified end-to-end in Chrome |
| Learner model: evidence-based statuses, decay, rubric track, spaced review | Tested (unit); dashboard review card tested in the browser only indirectly |
| AI contract: evidence quotes, safety layer, adapters | Tested with mocked model replies only |

## Phases

| Phase | Status |
| --- | --- |
| 0 Inspection and planning | Done (empty repo, git identity valid) |
| 1 Scaffolding | Done |
| 2 Design system | Done |
| 3 Core student experience | Done |
| 4 Graph and domain models | Done |
| 5 Core logic (replaces backend API) | Done, see `docs/API.md` |
| 6 Diagnostic engine | Done (rule-based). Gemini optional and untested live |
| 7 Mastery engine | Done |
| 8 Recovery and verification | Done |
| 9 Persistence | Local storage only. Supabase not started |
| 10 Integration | Done |
| 11 Testing | Done: unit, smoke and Playwright e2e (Chrome only) |
| 12 Security and performance | CSP, escaping, safe parsing, key handling done. No server so no rate limiting or server auth |
| 13 Deployment and documentation | Docs done. Nothing deployed (not authorised) |
| 14 Final verification | Done for the static prototype |

## Known limitations

- Profiles are local, with no password. Not real authentication.
- No database; clearing browser data deletes progress.
- Content is a seed: 7 tracks, 8 original problems.
- Graph layout is layered and simple: long edges can pass behind unrelated nodes.
- Math rendering is a lightweight sub/superscript formatter, not KaTeX.
- BKT parameters are fixed defaults, not fitted to data. Estimates move a lot on few answers.
- A wrong practice answer after a lesson lowers the estimate sharply, which is what the model says with a 0.10 slip rate but may feel harsh.
- Verification credits the target concept as well as the recovered one, so a target can reach mastered through verification without the original being re-solved.
- Only tested in Chrome. No Firefox or Safari runs yet.
- Several spec items are not implemented (backend, database, retrieval, code sandbox, multimodal input, minors' privacy, hinglish handling). See `docs/SPEC_ALIGNMENT.md`.
- Maps for new questions need a Gemini key and are AI-written, validated for structure but not for factual accuracy.
- Open-ended answers are judged by AI, so correctness there is a judgement, not a verified result. Fresh verification questions on custom maps are multiple choice and graded deterministically, but their correct answers also come from the model.
- The demo rubric is a handful of keyword rules for one question.
