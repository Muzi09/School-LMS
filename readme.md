# School-LMS

## Quick Start

### Start Frontend Server
```bash
cd Frontend
npm run dev 
```

### Start Backend Server
```bash
cd Backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

---

## Bell Timing Setups Architecture & Redesign

### 1. Conceptual Model
- **Setup:** A named group of classes (e.g., *Setup 1*, *Setup 2*) that share identical bell timings. Every class-section belongs to exactly one setup at any time.
- **Schedule:** Day-level timing configuration within a Setup. By default, all school working days share one schedule. Days can be split off into independent schedules (e.g., Saturday early departure or Friday assembly) and merged back as needed.
- **Period:** An ordered time slot having `type` (`CLASS`, `RECESS`, `ASSEMBLY`, `ACTIVITY`), `label` (`P1`, `P2`, `Recess`, etc.), `start_time`, and `end_time`. Class-type periods auto-number sequentially; non-class periods keep their type name.

---

### 2. Data Model Changes

#### `timetable_setups` table
- `order_index` (`INTEGER`, default `0`): UI display ordering for setups.
- `version` (`INTEGER`, default `1`): Optimistic concurrency control counter to detect concurrent edits.
- `schedules_json` (`TEXT`, nullable): JSON-serialized schedule definitions per day-group, storing day mappings, period configurations, and custom overrides.

#### `timetable_periods` table
- `schedule_id` (`VARCHAR(50)`, default `'default'`): Links a period to a specific day schedule within its setup.
- `period_type` (`VARCHAR(30)`, default `'CLASS'`): Categorizes periods into `CLASS`, `RECESS`, `ASSEMBLY`, or `ACTIVITY`.
- `uq_timetable_periods_setup_sched_num`: Updated unique composite index on `(setup_id, schedule_id, period_number)`.

#### `timetable_setup_classes` table
- Maps `(setup_id, class_id, section_id)` ensuring strict 1:1 mapping between each class-section and a timetable setup.

---

### 3. REST API Endpoints

All endpoints are mounted under `/api/v1/timetable`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/setups?timetable_id={id}` | Retrieve all setups with full schedule configurations, periods, and assigned classes/wings. |
| `POST` | `/setups` | Create a new setup for a timetable. |
| `PUT` | `/setups/{id}` | Update a setup name or configuration (enforces optimistic locking via `version`). |
| `DELETE` | `/setups/{id}` | Delete a setup (enforces zero-assigned-classes safety check; returns 422 if classes are still mapped). |
| `POST` | `/setups/{id}/duplicate` | Duplicate a setup's timings into a new setup (classes start empty). |
| `POST` | `/setups/split-days` | Split specified day(s) from a shared schedule into an independent schedule. |
| `POST` | `/setups/merge-days` | Merge an independent day schedule back into a target schedule. |
| `POST` | `/setups/move-classes` | Atomically reassign class-sections from their source setup to a target setup. |
| `POST` | `/setups/batch-save` | Atomically validate and persist all setups, day schedules, periods, and class assignments. |
| `POST` | `/setups/preview-impact` | Dry-run check for timetable slots impacted by proposed timing modifications. |

---

### 4. Migration Runbook

#### Applying the Migration
Run the Alembic migration from the `Backend` directory:
```bash
cd Backend
PYTHONPATH=. ./venv/bin/alembic upgrade head
```

#### Rollback Verification
To roll back the migration safely:
```bash
cd Backend
PYTHONPATH=. ./venv/bin/alembic downgrade -1
```
Re-running `alembic upgrade head` re-applies columns and constraints losslessly.

#### Backward Compatibility Strategy
- Existing legacy setups continue to function. If `schedules_json` is null, the backend automatically generates a normalized default schedule from the legacy columns (`start_time`, `period_duration_minutes`, `total_periods`, `recess_after_period`, `recess_duration_minutes`).
- Legacy `timetable_periods` are backfilled with `schedule_id = 'default'` and `period_type = 'CLASS'`.
- Foreign key dependencies (`TimetableEntry.period_id`) remain intact.

---

### 5. Validation Rules
- **No Overlapping Periods:** Start time must strictly precede end time within the same 24-hour day (no midnight crossings).
- **Duration Boundaries:** Minimum duration is 5 minutes; maximum is 180 minutes.
- **Coverage Invariant:** Every working day of the school must map to exactly one schedule (no orphaned or duplicate days).
- **Zero-Orphan Section Rule:** Every class-section in the school must belong to exactly one setup when saved.
- **Class Period Requirement:** Every schedule must contain at least 1 `CLASS` type period.
- **Period Limit:** Maximum 20 periods per schedule.
- **Optimistic Concurrency:** Saving an outdated setup version returns `409 Conflict`.

---

### 6. Test Suites

#### Backend Pytest Tests
```bash
cd Backend
PYTHONPATH=. ./venv/bin/pytest tests/test_bell_timing.py
```
Coverage:
- Strict time boundary and overlap validations (`5-180m`, no overlaps, start < end).
- Day split, merge, and move classes logic.
- Orphan detection and atomic transaction rollback.
- Optimistic locking (`version` 409 conflict detection).
- Delete guard on setups with assigned classes.

#### Frontend Vitest Tests
```bash
cd Frontend
npx vitest run src/pages/timetable/bellTiming/__tests__/
```
Coverage:
- `timeUtils.test.js`: Lenient time parsing ("9", "930", "9:30", "9:30 am", "21:30"), duration computations, 12h/24h conversions.
- `validators.test.js`: Frontend schedule invariants, period overlap checks, coverage invariants.
- `scheduleReducer.test.js`: Period additions, cascade adjustments (`shift`, `fixed_end`, `none`), auto-renumbering, day split/merge, class moves, undo/redo history.
- `components.test.jsx`: Day tabs folder-style rendering, period modal inputs, duration chips, wing card section displays, modal transitions.

---

### 7. Known Limitations & Design Decisions
- **Single Calendar Day:** Timings operate strictly between `00:00` and `23:59`. Night classes crossing midnight require splitting into two periods.
- **Browser Accessibility:** Full keyboard navigation (focus trap, Esc to close, Tab traversal, accessible labels) is implemented.
- **Lenient Time Inputs:** Freeform text inputs automatically sanitize and normalize user inputs to standard 24h `"HH:mm"` format while displaying in 12h/24h according to user locale.
