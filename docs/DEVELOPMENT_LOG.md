# Development log

## Decisions

- **Stack.** The brief asked for Next.js, FastAPI, Supabase and Gemini. The requirement for this build was HTML, CSS and JS that opens as a webpage, so the app is static and framework-free. Core logic stays pure so a server can adopt it later.
- **Classic scripts, not ES modules.** Chrome blocks module imports from `file://`. Classic scripts keep double-click-to-open working. Core files attach to `window.MT` and also export for Node, so the same code is tested.
- **Deterministic first.** Answer correctness is never delegated to a model. The rule-based engine uses per-problem error signatures. Gemini is optional and only classifies answers with no known signature.
- **Suspected vs confirmed.** Hypotheses come from signatures plus a graph ranking. A gap is only confirmed after a failed probe moves the BKT estimate below 0.45.
- **Honest labelling.** Every diagnosis states which engine produced it. Demo fixtures are labelled. Untested integrations are called out in the UI and docs.

## Issues found while building and how they were fixed

- `node --test tests/` fails on Node 26 (treats the folder as a file). Switched to a glob.
- A wrong-answer signature could coincide with the correct answer for some random seeds (for example q = 0.5 in the Hardy-Weinberg count template). `instantiate()` now drops colliding signatures and a test covers it.
- Pointer capture on `pointerdown` retargeted clicks to the SVG, so nodes could not be selected with a real mouse. Capture now starts only once a drag begins. Synthetic click events had hidden this; it was caught by clicking in a real browser.
- Settings saved by an earlier build were missing a newly added key, hiding the worked solution. Settings are now merged over defaults.
- Browser caching served a stale script during testing. Documented in the README troubleshooting section.
- Test off-by-one mistakes (escalation count, sliding window) were test errors, not code errors; the intended behaviour is documented in the tests.

## Not done

Playwright suite, real auth, database, live Gemini verification, KaTeX, first-year CSE track. See `docs/ROADMAP.md`.
