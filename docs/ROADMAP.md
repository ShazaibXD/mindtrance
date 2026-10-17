# Roadmap

## Prototype (this repo)
- Six tracks: EEE transformers, JEE Physics, JEE Chemistry, JEE Maths, NEET Biology, GATE CS
- Rule-based diagnosis, BKT mastery, probes, recovery, fresh verification
- SVG knowledge gap map, progress analytics, local persistence

## Next
- Real authentication and a hosted database (Supabase with row-level security)
- FastAPI service with SymPy for symbolic verification of free-form answers
- KaTeX rendering and richer working-step capture
- Server-side Gemini calls so no API key lives in the browser
- More tracks: first-year CSE, NEET Chemistry, JEE Maths calculus and algebra
- Calibrate BKT parameters from real response data
- Playwright end-to-end suite in CI

## Known gaps in the prototype (carried from PROGRESS)
- First-year CSE track (number systems, basic programming) is not authored yet
- Automated browser interaction tests
- Better edge routing in the graph for long dependencies
- Verify the Gemini path against the live API behind a server-side proxy
