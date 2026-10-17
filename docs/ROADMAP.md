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
- More tracks: more first-year CSE (programming basics), NEET Chemistry, JEE Maths algebra and coordinate geometry
- Calibrate BKT parameters from real response data
- Run the Playwright suite in CI, add Firefox and WebKit projects

## Known gaps in the prototype (carried from PROGRESS)
- Better edge routing in the graph for long dependencies
- Verify the Gemini path against the live API behind a server-side proxy
