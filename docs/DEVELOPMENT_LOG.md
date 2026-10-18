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

## Second pass: CSE track and end-to-end tests

- Added a first-year CSE track on two's complement. Binary answers are stored as numbers like `11110011` so the existing numeric checker and exact matching work with no engine change. Wrong-answer signatures cover one's complement (forgot +1), sign-magnitude, no inversion and reversed remainders. A palindromic example (45 = 101101) was avoided on purpose because reversal would not be distinguishable.
- Added a Playwright suite (36 tests) that drives the installed Chrome, so no browser download. It uses a tiny Node static server rather than depending on Python. Tests found two selector ambiguities in the suite itself and no application bugs.
- Generated verification answers are read from app state in the tests because they are random; everything else goes through the UI.

## Third pass: universal input

Prompted by the recommendation to support non-STEM subjects and open-ended answers, and to keep the uploaded backend's ideas (map generation, mistake classification, targeted probes, BKT) as the foundation.

- The Python `generate-track` and `diagnose-attempt` schemas were ported to JavaScript and extended: more concepts, per-concept probe, practice and two fresh questions, and a judgement that can say an answer is correct. The Python service itself is not part of this repo.
- Correctness for open-ended answers cannot be deterministic, so it is an explicit, labelled AI judgement. Verification of learning is kept deterministic by using multiple-choice fresh questions tagged with the concept being recovered.
- Weak evidence (below 60%) now turns the probe into a visibly labelled follow-up question for every track, not just custom ones.
- Custom maps are stored as validated plain data and rebuilt into tracks, so no code path is special-cased downstream. Deleting a question removes its sessions, mastery and events so analytics never reference a missing track.
- A scripted history fixture and keyword rubric make the loop demonstrable without a key and are labelled as not AI.
- Playwright's `page.route` is used to mock the Google endpoint, so the real client code (headers, schema, validation, error handling) is exercised in the browser without network access or a key.

## Fourth pass: aligning with the universal-diagnostic specification

The user attached a platform-sized specification. After asking, the chosen scope was to align the browser app, not to build the server stack. Decisions worth recording:

- **Evidence over ritual.** The old rule "always probe before confirming" was replaced by the spec's tiers. This changed the demo: a bare wrong answer now needs a probe, but an answer with the working shown is confirmed directly. The demo has two buttons to show both.
- **Outcomes by policy kind.** Behavior depends on `OUTCOMES[x].kind` (gap, slip, ambiguous...) rather than on label strings, so a new outcome only needs a row in the table.
- **Display status is not lock status.** Adding "learning in progress" would have lifted the lock on the original problem mid-recovery. The lock uses the underlying gap check, with a test.
- **A weak essay is not a confirmed miss.** Rubric scores below 0.5 are recorded but do not set the failure count, otherwise the target concept itself became "confirmed gap" and hid the blocked-by-prerequisite state.
- **Hints do not teach.** The spec applies a 0.10 learning transition after a hint. That would raise mastery with no evidence, so it is not applied. Documented in the alignment file.
- **Grounded evidence.** A model diagnosis is thrown away if its quoted evidence is not in the student's own text. A bare answer caps confidence at 0.5 regardless of the model.
- **Honesty about verifiers.** The adapter table marks seven of nine adapters as having no real deterministic verifier in the browser.
- A Python patch with an unescaped quote silently applied nothing once; and a second patch deleted a shared helper. Both were caught by the test suite within a minute, which is the argument for keeping the suites fast.

## Fifth pass: visual redesign with Lenis, GSAP, Vanta and react-bits ideas

- **react-bits is React-only**, so none of its code was used. The ideas (split text, spotlight cards, magnetic buttons, marquee, count-up) were re-written in vanilla JS. The other three libraries were vendored from npm so the site remains static and CSP-clean (`script-src 'self'`).
- **Tests run in reduced-motion mode.** Playwright's `reducedMotion: 'reduce'` makes the app render with no animation, which removes a whole class of flaky waits. A dedicated spec turns motion back on and checks the effects.
- **A test caught an accessibility bug:** the split headline's `aria-label` had lost the space at the line break. Fixed and covered.
- **Reviewing frames by eye mattered:** the first hero had the network crossing the headline, a headline that wrapped to four lines, mismatched left edges between nav and sections, a focus ring on the h1, edges visible through translucent graph nodes, and green bars for tracks that had not been started. All fixed.
- **Restraint:** no gradient decoration beyond the legibility masks, no backdrop blur, no glow or sparkle, no invented statistics (the numbers on the landing page are computed from the data, and the evidence gauges come from the real engine).

## Bug-fix pass

- **Saved data from earlier versions crashed the diagnosis card.** Old outcome names (`CARELESS_SLIP`, `UNIT_ERROR`, `CONCEPT_MISCONCEPTION`, `CORRECT`) were kept in saved sessions and events, and the new UI looked them up in a table that no longer had them, which produced the "Something went wrong" page for anyone returning with saved progress. Fixed twice over: a one-time migration of stored data (schema 2) and a lookup that cannot throw (`outcomeMeta`). A unit test and a browser test use a realistic old save, and the browser test was confirmed to fail without the fix.
- **Nothing else found** by a randomized stress test of the flow engine (400 runs of 40 random steps checking state, estimate range and serialisability), a sweep of every route at three widths with and without motion, and rapid navigation, history and double-click checks.
- **Two flaky tests made reliable:** the headless-Chrome smoke tests now retry when the machine is busy, and the graph-zoom test waits for the entrance animation to finish.

## Demo pass: a self-explanatory guided tour

The demo showed seven mode buttons, a generic explainer, a dense paragraph and scattered fill-in buttons, and never said what to do next or why. It now has a tour (`js/ui/demo.js`) that follows the session state.

- **Pure step function.** `step()` maps session state to a step description with no DOM, so every state is unit-tested, and text uses the real numbers (evidence score, estimate before and after).
- **Highlight, do not block.** The next control is outlined and scrolled into view, and shortcuts do the tedious clicks, but the visitor still presses the real buttons, so they learn the interface.
- **Plain words in the product itself.** The diagnosis card gained an "In plain words" sentence for everyone, not only in the demo.
- **Found by looking at it:** on a phone the tour came after the form, and the auto-scroll jumped past it; the tour and the page's own note said the same thing twice; and after the follow-up question confirmed the gap, the Diagnosis card still said "not enough evidence yet", contradicting the tour. All fixed.
- **Heading clashes matter.** Tour titles had to avoid the headings the page already uses ("Gap confirmed", "Diagnosis", "Correct"), both for tests and for screen-reader users who navigate by heading.

## Not done

Real auth, database, live Gemini verification of any of the three AI paths, KaTeX, cross-browser runs. See `docs/ROADMAP.md`.
