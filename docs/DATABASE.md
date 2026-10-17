# Data and persistence

## What is implemented: browser storage

There is no database in this build. State is one JSON document in `localStorage` under the key `mindtrace.v1`:

```
{ v: 1, active: <profileId|null>, profiles: { <id>: {
    id, name, createdAt, demo,
    data: { settings, mastery, events, sessions, seq } } } }
```

- `mastery["<trackId>:<conceptId>"]` is `{ p, obs, fails, learned, updatedAt }`.
- `events` is an append-only log (capped at 2000). Types: `ATTEMPT`, `OBSERVATION`, `LEARNING`, `RECOVERY_STARTED`, `MASTERY_VERIFIED`, `VERIFICATION_FAILED`. Observations and learning are separate event types.
- `customs[trackId]` holds `{ id, spec, question, source, createdAt }` for questions the student asked. Tracks are rebuilt from the spec on load; functions are never stored.
- `sessions` hold the diagnostic state machine state, the attempt, diagnosis, probes, gap, recovery and verification so a page refresh resumes exactly where the student left off.
- Settings are merged over defaults on read, so older saves keep working.

Authorization assumption: anyone with the browser profile can read the data. Profiles are a convenience for sharing one browser, not a security boundary. The optional Gemini key is stored in plain text in the same document and is excluded from exports.

## What is proposed, not implemented: Supabase

The brief asked for PostgreSQL with Row Level Security. None of the SQL below has been run.

```sql
create table profiles (id uuid primary key references auth.users, display_name text, created_at timestamptz default now());
create table concepts (id text primary key, track_id text, name text, level int check (level between 1 and 3), prior real check (prior > 0 and prior < 1));
create table prerequisite_edges (concept_id text references concepts, prerequisite_id text references concepts, weight real check (weight > 0 and weight <= 1), primary key (concept_id, prerequisite_id));
create table attempts (id uuid primary key default gen_random_uuid(), user_id uuid references profiles not null, problem_id text, answer text, working text, category text, confidence real, created_at timestamptz default now());
create table concept_mastery (user_id uuid references profiles, concept_id text references concepts, p real, obs int, fails int, primary key (user_id, concept_id));
create table learning_events (id bigserial primary key, user_id uuid references profiles not null, type text, concept_id text, before real, after real, session_id uuid, created_at timestamptz default now());

alter table attempts enable row level security;
alter table concept_mastery enable row level security;
alter table learning_events enable row level security;
create policy own_rows on attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on concept_mastery for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on learning_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Remaining tables from the brief (domains, subjects, topics, problems, diagnoses, probes, probe responses, recovery sessions, verification problems and responses) follow the same pattern. Row-level isolation would need to be tested before this is trusted.
