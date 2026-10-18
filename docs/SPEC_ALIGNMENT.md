# Alignment with the "Universal AI Learning Diagnostic System" specification

The specification describes a Next.js + FastAPI + Supabase platform. This repository is a static browser app, by request, so everything that needs a server, database, vector store or code sandbox is **not implemented**. This file states, section by section, what is implemented, what is adapted, and what is missing.

Legend: **Done** implemented and tested. **Adapted** the idea is implemented in a browser-sized form. **Partial** some of it. **No** not implemented.

## Goals (section 2)

| Goal | Status | Notes |
| --- | --- | --- |
| Root-cause investigation, variable-depth DAG | Adapted | Built-in tracks are hand-authored (5 to 6 concepts). Maps built from a question have 4 to 6 concepts, validated acyclic and fully connected to the target. Not the open-ended 1..N of the spec |
| Respect learning modes | Done | All seven modes exist. Hint, explain and teach-from-basics need no attempt. Solve, check, diagnose and exam prep share one pipeline (see below) |
| Fine-grained error taxonomy | Done | All 11 outcomes, with an action policy. `LANGUAGE_COMPREHENSION_DIFFICULTY` and `PARTIAL_UNDERSTANDING` can only come from the AI judge |
| Universal subject adaptability | Partial | Any question works if a Gemini key is present. Built-in content covers 7 tracks. Subject adapters exist, but only math and units have a real deterministic verifier |
| Closed-loop verification | Done | Fresh generated questions for built-in tracks, fresh multiple-choice for custom maps |
| Epistemic humility | Done | Composite evidence score with the 0.45 and 0.75 thresholds, "not enough evidence yet" outcome, estimates labelled as estimates |

Non-goals: no code is ever executed (Done, trivially: there is no code runner, so programming questions rely on the AI judge only). No fine-tuning (Done).

## Workflow (section 4)

| Stage | Status | Where |
| --- | --- | --- |
| 1 Input and intention capture | Done | Mode chips in the workspace. No profile fields for education level or curriculum beyond what the model infers |
| 2 Question understanding | Partial | `question_type`, `education_level`, `language` and clarification come from the map builder. No `classification_confidence`, no persisted `QuestionAnalysis` object, no multilingual concept slugs |
| 3 Concept decomposition | Done for custom maps | Edges carry rationale, strength (REQUIRED or SUPPORTING) and confidence. Uncertain edges (below 0.6) are drawn dotted. Cycles and orphans are rejected. No coupled-concept clusters |
| 4 Evidence gathering | Done | Evidence items, weights and tiers. A bare wrong answer triggers a probe. Mode-specific skipping of probes |
| 5 Root-cause diagnosis | Done | Rule-based signatures, working-step keywords, generic slip detection, optional AI reading |
| 6 Gap map | Adapted | Custom SVG instead of React Flow. All six lifecycle statuses are shown, plus blocked. Accessible table alternative |
| 7 Recovery tutor | Partial | Lesson, misconception, worked example, practice. Procedural errors skip the definition. No analogies or diagrams are generated, no three-level scaffolding beyond hints |
| 8 Independent verification | Partial | See section 10.2 below. Probe cap and recovery cap are enforced |
| 9 Learner model | Done | See section 11 below |
| 10 Next best action | Partial | Deterministic: continue, recover, spaced review, try next. No generated coaching copy |

## State machine (section 5.1)

The implemented machine is finer-grained. Mapping:

| Spec state | Implemented |
| --- | --- |
| RECEIVED, ANALYZED | `READY` (a session exists; a custom map has been built) |
| CLARIFYING | Handled on the Ask page before any session exists (deterministic pre-check or the model asks). Not a persisted session state |
| DIRECT_EXPLANATION | `DIRECT_EXPLANATION` |
| PROBING | `PROBE_REQUIRED` |
| DIAGNOSED | `ERROR_CLASSIFIED`, `GAP_CONFIRMED`, `RETRY_REQUIRED` |
| RECOVERING | `RECOVERY_REQUIRED`, `RECOVERY_IN_PROGRESS` |
| VERIFYING | `VERIFICATION_REQUIRED` |
| MASTERED_UPDATED | `MASTERY_VERIFIED` |
| SOLVING_ORIGINAL | `RETRY_REQUIRED` then `READY` |
| ESCALATED_TO_SOLUTION | `ESCALATED_TO_SOLUTION` |
| COMPLETED | `ATTEMPT_CORRECT` |
| ABANDONED | No |
| (extra) | `REASONING_CHECK`, for a right answer with no reasoning |

Illegal transitions throw. Persisted after every step.

## Taxonomy and action policy (section 5.2)

All 11 outcomes are defined in `MT.diagnose.OUTCOMES` with a `kind` that drives behavior.

| Outcome | How it is produced here |
| --- | --- |
| CORRECT_UNDERSTANDING | Deterministic match, or a correct AI or rubric judgement with reasoning |
| CORRECT_ANSWER_UNVERIFIED_REASONING | A short right answer to an **open** question with no reasoning. Not raised for typed numeric answers, which have a low guess rate |
| CONCEPTUAL_GAP, PREREQUISITE_GAP | Error signatures and graph ranking, or the AI judge |
| PROCEDURAL_ERROR | Signatures tagged as such (a sign, a missed factor, an exponent off by one). Recovery skips the definition |
| CALCULATION_OR_UNIT_ERROR | Power-of-ten, sign, digit-order and near-miss detection, unit dimension mismatch, or a correct setup in the working. Repeated unit errors escalate to a probe |
| READING_OR_INTERPRETATION_ERROR | Signatures where the answer solves a different question (for example reporting the voltage as the current) |
| POSSIBLE_CARELESS_SLIP | A slip when the target concept's estimate is already above 0.80, or tagged signatures |
| LANGUAGE_COMPREHENSION_DIFFICULTY, PARTIAL_UNDERSTANDING | AI judge only |
| AMBIGUOUS_OR_INSUFFICIENT_EVIDENCE | Evidence score below 0.45, or no known pattern |

## Orchestration rules (section 5.3)

Implemented in `js/flow.js`: strong evidence (S_E 0.75 or more) confirms a gap with no probe, 0.45 to 0.75 gets a hypothesis and one check, below 0.45 gets "not enough evidence" and a probe. At most **2 probes** per question, then `ESCALATED_TO_SOLUTION` with a worked solution and the concepts scheduled for review. At most **2 recovery cycles**, then the same escalation. Explanation modes bypass probing. Not implemented: the "teacher tip" is plain text, and there is no stored worked solution for open-ended questions.

## Subject adapters (section 7)

Nine adapters (`MT.adapters`): guidance for decomposition, probe style, verification format, estimator choice, recovery blocks. **Verifiers:** only the math (algebraic equivalence by sampling) and physics (units) adapters have anything real. Chemistry, biology, programming, languages, humanities, commerce and writing are marked as having no verifier here. SymPy, Pint, `ast` and sandboxes are not used.

## Concept graph (section 8)

Statuses: NOT_ASSESSED, POSSIBLE_GAP (shown as "Possible gap", id `SUSPECTED_GAP`), NEEDS_VERIFICATION, LEARNING_IN_PROGRESS, READY_FOR_REASSESSMENT, PROVISIONALLY_MASTERED (id `MASTERED`, needs two observations) plus CONFIRMED_GAP and BLOCKED. A starting assumption is never shown as mastery. No `canonical_slug`, no embeddings, so mastery does not transfer between differently worded questions.

## Evidence model (section 9)

Weights are the spec's: deterministic step 0.90, written reasoning 0.85, probe 0.75, history 0.70, bare answer 0.35. Added here, not in the spec: AI judgement 0.60 and demo rubric 0.50. `S_E = 1 - product(1 - w * r)`, with documented `r` values. The score is shown, with its items, in the diagnosis card.

## Recovery and verification (section 10)

Done: no lesson for slips, procedural variant, personalised misconception. Partial: no analogies, diagrams or guided micro-steps. Verification rule 1 (isomorphic, different surface) is Done for built-in tracks (generators). Rule 2 (answer plus a one-line step check) is **No**. Rule 3 (answer key from a deterministic solver) is Done for built-in tracks and **No** for custom maps, whose multiple-choice answer keys come from the model.

## Learner model (section 11)

Track A: Done, with format-adjusted guess (1/3 for three-option multiple choice, 0.05 for typed answers), recovery transition 0.30, temporal decay toward the prior with half-life starting at 7 days that doubles on each spaced verification (capped at 56), spaced review scheduling. **Not done:** the context-adjusted slip probability (0.20 after a calculation error) and the default priors of 0.40 and 0.60 (priors are hand-set per concept). A hint does not apply the 0.10 learning transition: crediting learning from a hint with no evidence was judged misleading. Track B: Done (`MT.bkt.rubricUpdate`, gamma 0.85, uncertainty 1/(1+W)), used for open-ended answers on rubric-type subjects.

## AI contract (section 18)

| Prompt | Status |
| --- | --- |
| 1 Question understanding, 2 Decomposition | One combined call (`generateTrack`) |
| 3 Prerequisite validation | Deterministic validator, no second model call |
| 4 Attempt diagnosis | `classify` and `judgeOpen`, with exact-substring evidence quotes, a bare-answer confidence cap and a judgemental-wording filter |
| 5 Probe, 6 Recovery lesson, 7 Verification generation | Generated inside the map call, or hand-authored for built-in tracks. Not separate on-demand calls |
| 8 Rubric assessment | `judgeOpen` returns one overall rubric score, not per-criterion scores |
| 9 Recommendation copy | No: deterministic selection with fixed text |

All AI paths are tested against mocked responses only.

## Not applicable or not implemented

Sections 12 to 17 and 24 to 25 (architecture diagrams, frontend and backend module layouts, REST contracts and backward-compatible endpoints, the PostgreSQL schema, folder structure, environment variables, deployment): not implemented. The functional equivalents are in `docs/API.md` and `docs/DATABASE.md`. Section 19 (curriculum retrieval): No. Section 20.3 (minors' privacy and consent): No. There is no server, so data stays in the browser, but there is no age-appropriate handling.

## The 16 scenarios (section 22)

| # | Scenario | Status |
| --- | --- | --- |
| 1 | Fraction addition | No track; would need a Gemini key |
| 2 | Transformer numerical | Done (built-in track, end to end) |
| 3 | pH and dilution | Partial: the dilute-acid pH track, not the dilution concept question |
| 4 | Cellular respiration | No |
| 5 | Python off-by-one | No: nothing executes code |
| 6 | Subject-verb agreement | No |
| 7 | History causal reasoning | Done (demo fixture; rubric is scripted) |
| 8 | Demand shift | AI only, untested live |
| 9 | Control systems | No |
| 10 | Right answer, flawed reasoning | Done for open-ended answers (the chemistry example itself is not built) |
| 11 | Calculation slip vs gap | Done in behavior (no retraining, no mastery penalty); the kinetic-energy problem is not built |
| 12 | Insufficient information | Done (deterministic pre-check and model clarification) |
| 13 | Repeated probe failure | Done, with an automated test of the ceiling of two |
| 14 | Improvement after recovery | Done in behavior (transformer, not parallel resistors) |
| 15 | Uncertain prerequisite | Done (supporting, low-confidence edge, drawn dotted) |
| 16 | Hinglish input | No: a language field is recorded but responses are not localised |

## Acceptance checklist (section 27)

The spec ticks every box for its own design. For this repository: subject-agnostic (Partial: depends on the model), variable-size DAG (Adapted, 4 to 6), taxonomy (Done), student agency (Done), anti-hallucination and humility (Done for the browser-side checks), strict component separation (Done: `core` modules are pure and tested independently), backward API compatibility (No: no API), non-shaming UX with an accessible table (Partial: wording and table done, no dedicated non-red palette).
