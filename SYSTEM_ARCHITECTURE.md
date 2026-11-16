# School-LMS — Master System Architecture & Living Reference

> **Document Status**: Living Master Document  
> **Last Updated**: November 2026  
> **Purpose**: Serves as the definitive architectural blueprint, data dictionary, and operational runbook for the School-LMS platform. This document provides instant context anchoring for engineers and AI agents working on this codebase.

---

## 1. System Overview & Core Mission

**School-LMS** is an enterprise-grade School Management & Academic Logistics Platform designed for K–12 schools and educational institutions. It automates academic planning, timetable generation, staff allocation, student lifecycle tracking, and institutional administration.

### Multi-Tenancy & Data Isolation Model
- **Tenant Anchor**: Every institutional record is strictly partitioned by `school_id` (`UUID`).
- **Data Boundary**: Cross-tenant data leakage is strictly prohibited. All SQL queries, service layers, and REST endpoints filter by `school_id` retrieved directly from the verified session user.
- **Role-Based Access Control (RBAC)**: Defined by `UserRole` (`app.models.enums`):
  - `ADMIN (0)`: Super Administrator with global platform visibility and school provisioning capabilities.
  - `PRINCIPAL (1)`: Institutional administrator managing school settings, wings, classes, staff, and timetable publishing.
  - `STAFF (2)`: Teaching and administrative personnel with role scopes (`is_academic`, `is_non_academic`).
  - `STUDENT (3)`: Enrolled learners accessing class timetables and educational resources.
  - `SALES_PERSON (4)`: Onboarding and platform adoption representatives.

---

## 2. Complete Technology Stack

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Vite / React 19)"]
        A["React 19 + JavaScript"] --> B["Tailwind CSS v4 + shadcn/ui"]
        B --> C["TanStack Query v5 (Data Fetching / Cache)"]
        C --> D["React Router DOM (URL State Sync)"]
        D --> E["Vitest (Automated Unit & Algorithmic Tests)"]
    end

    subgraph Backend ["Backend (FastAPI / Python 3.14+)"]
        F["FastAPI REST Endpoints"] --> G["Pydantic v2 (Strict Schema Validation)"]
        G --> H["Service Layer (Business Logic & Algorithmic Engines)"]
        H --> I["SQLAlchemy 2.0 ORM (Mapped Columns & Row Locks)"]
        I --> J["Alembic (Idempotent DB Migrations)"]
    end

    subgraph Persistence ["Persistence Layer (PostgreSQL)"]
        K[("PostgreSQL 15+ / Row-Level with_for_update()")]
    end

    Frontend <-->|HTTP / JSON REST & Cookies| Backend
    Backend <-->|SQLAlchemy Engine & Pool| Persistence
```

### Backend Infrastructure
- **Runtime**: Python 3.14+ (Virtual Environment at `Backend/venv`).
- **Web Framework**: FastAPI (Asynchronous & Synchronous endpoints with dependency injection).
- **ORM & Database**: SQLAlchemy 2.0 (`Mapped` typed attributes), Alembic for schema migrations.
- **Relational Engine**: PostgreSQL with strict Foreign Key constraints, indexed audit columns, and pessimistic row locking.
- **Validation**: Pydantic v2 (Strict boundary validation at the HTTP layer with custom field validators).
- **Security & Session**: JWT (HS256) bearer tokens, PBKDF2/bcrypt password hashing, optional fast PIN login for classroom staff.

### Frontend Infrastructure
- **Framework**: React 19 (SPA with React Router DOM).
- **Bundler & Tooling**: Vite 8.2+ with Rolldown compiler and PostCSS.
- **Styling & UI Kit**: Tailwind CSS v4, shadcn/ui, Radix UI headless primitives, Lucide React icons.
- **Server State**: TanStack Query (React Query v5) with query key factories and cache invalidation.
- **Local & URL State**: Bidirectional synchronization between URL query parameters (`?timetable_id=...&perspective=...&wing=...`) and React state.
- **Test Harness**: Vitest with `@testing-library/react`.

---

## 3. Core Functional Modules

```mermaid
graph TD
    School["School (Root Tenant)"] --> Wing["Wings (Primary, Middle, Senior)"]
    Wing --> SchoolClass["School Classes (Grade 1 - 12)"]
    SchoolClass --> Section["Sections (A, B, C)"]
    SchoolClass --> Subject["Subjects (Academic / Split)"]
    Staff["Staff (Teachers / Admin)"] --> ClassSubject["Class-Subject Allocations"]
    Section --> TimetableEntry["Timetable Entries"]
    Subject --> TimetableEntry
    Staff --> TimetableEntry
    Timetable["Timetable Aggregate"] --> TimetableSetup["Bell Setups"]
    TimetableSetup --> TimetablePeriod["Timetable Periods"]
    TimetablePeriod --> TimetableEntry
```

### A. School Structure & Hierarchy
- **`School` (`schools`)**: Holds school branding, affiliation, contact information, and academic calendar settings.
- **`Wing` (`wings`)**: Logical institutional division (e.g., *Pre-Primary, Primary, Middle, Secondary*).
- **`SchoolClass` (`school_classes`)**: Standard grades (e.g., *Grade 6, Grade 7*). Joined to wings via `wing_classes`.
- **`Section` (`sections`)**: Individual classroom cohorts (e.g., *6-A, 6-B*). Linked to `class_teacher_id` (`User`).
- **`House` (`houses`)**: Student houses for extracurricular activities and color competitions.

### B. Staff & Faculty Management
- **`User` (`users`)**: Core identity record with email, login mobile, role, and hashed credentials.
- **`StaffProfile` (`staff_profiles`)**: Stores roll number, department, designation, academic/non-academic flags, and shift preferences.
- **`StaffWing` (`staff_wings`)**: Multi-wing mapping associating teachers with applicable school sections.
- **`StaffOnboardingToken`**: Secure, time-limited token enabling principal-driven email invitations.

### C. Student Lifecycle
- **`StudentProfile` (`student_profiles`)**: Stores enrollment number, assigned class and section, guardian details, and emergency contacts.

### D. Subjects & Curriculum Allocation
- **`Subject` (`subjects`)**: Supports standalone subjects, elective categories, and split/parent-child lab pairings (`is_split`, `parent_id`).
- **`ClassSubject` (`class_subjects`)**: Triple-binding entity allocating a specific teacher to teach a subject in a specific class-section with weekly period quotas.

### E. Internal Communications
- **`Chat` (`chats`, `chat_messages`)**: Direct messaging and school announcement channels between staff and administration.

---

## 4. Timetable Management Engine (Deep Dive)

The Timetable module is the most algorithmically complex system in the LMS. It handles bell timing schedules, room/teacher conflict checks, multi-day variations, drag-and-drop allocations, and official board publishing.

### 1. Conceptual Model: Setup vs. Schedule vs. Period
- **Timetable (`timetables`)**: Root aggregate container for an academic year. Supports `is_active` (currently followed by school) and `status` (`DRAFT`, `PUBLISHED`).
- **Setup (`timetable_setups`)**: A group of classes that ring bells together (e.g., *Primary Setup 08:00–13:30*, *Senior Setup 08:30–14:30*).
- **Schedule**: Day-level timing configuration within a Setup. By default, days share one `regular` schedule. Days can be split off into independent schedules (e.g., `saturday` half-day, `friday` assembly) and merged back as needed.
- **Period (`timetable_periods`)**: The individual slot. Types:
  - `CLASS`: Teaching periods (auto-numbered sequentially: `P1`, `P2`, `P3`).
  - `RECESS`: Break/Lunch interval.
  - `ASSEMBLY`: Morning gathering or pledge.
  - `ACTIVITY`: Sports, clubs, or zero-hour activities.

---

## 5. Architectural Invariants & Recent Technical Upgrades

The system enforces strict invariants implemented across Points 1 to 4 of the architectural overhaul:

### A. Point 1: Data Structures & Integer Time Arithmetic
- **Eliminated Dual-Storage ("Two Notebooks")**: The canonical database table `timetable_periods` is the single source of truth. Legacy JSON period duplicates have been fully synchronized.
- **Sub-Nanosecond Integer Minutes**: All timeline dragging, period snapping, start/end comparison, and duration arithmetic operate purely on integer minutes from midnight ($0 \dots 1439$). String or floating-point comparison is banned in business logic.
  $$\text{totalMinutes} = \text{hours} \times 60 + \text{minutes}$$

### B. Point 2: API Protocol & Payload Efficiency
- **Strong Pydantic Typing**: Untyped `Dict[str, Any]` bypasses in batch payloads have been replaced with strongly-typed `BatchSetupItem` schemas, returning clean `422 Unprocessable Entity` errors at the HTTP gate if malformed.
- **Zero-Payload Bloat (~50% Reduction)**: Removed duplicate top-level `periods` arrays from setup responses in favor of the schedule period tree.
- **Post-Mutation Single-Record Reader**: Replaced heavy whole-school list queries ($6$ relational joins) on setup mutations with `get_setup_read(school_id, setup_id)`, which reads only the mutated entity in a single targeted query.
- **$O(1)$ Hash Map Lookups**: Class and wing assignment lookups use pre-grouped dictionaries (`sections_by_class`, `sections_by_wing`) rather than nested linear loops ($O(A \times S)$).

### C. Point 3: Algorithmic Precision ($O(N \log N + k)$ Sweep-Line)
- **Sweep-Line Overlap & Gap Detection**: Replaced adjacent-only loops with a chronological interval sweep-line algorithm in both [bell_timing_validator.py](file:///Backend/app/services/bell_timing_validator.py) and [validators.js](file:///Frontend/src/pages/timetable/bellTiming/validators.js).
- Detects non-adjacent collisions, out-of-order periods, zero-duration slots, and inter-period gaps across any arbitrary sequence of classes, breaks, and multi-track schedules.
- **Structural Sharing in Reducer**: Eliminated recursive `JSON.parse(JSON.stringify(state.setups))` calls in `scheduleReducer.js`. Undo/redo histories and timeline drag actions clone only modified nodes, eliminating GC pauses and memory churn.

### D. Point 4: Concurrency & Transactional Invariants
- **Atomic Optimistic Concurrency Control (OCC)**:
  - Setup tables include a `version: int` column.
  - During `batch_save_setups` and `update_setup`, existing rows are locked using PostgreSQL row-level locks:
    ```python
    db.query(TimetableSetup).filter(...).with_for_update()
    ```
  - Stale versions trigger an immediate HTTP `409 ConflictException` before performing writes.
- **Timetable Root Aggregate Versioning**:
  - The root `Timetable` record is locked and version-bumped via `_touch_timetable(school_id, timetable_id, user_id)` across all mutating actions (`create_setup`, `update_setup`, `delete_setup`, `split_days`, `merge_days`, `move_classes`, `batch_save_setups`).
- **Zero-Orphan Section Rule**:
  - Every class section in the school must belong to exactly one bell schedule setup. Saving an orphan-leaving configuration raises a `422 Unprocessable Entity` error.

---

## 6. Database Entity-Relationship Diagram

```mermaid
erDiagram
    schools ||--o{ wings : contains
    schools ||--o{ school_classes : operates
    schools ||--o{ users : employs
    schools ||--o{ timetables : owns
    wings ||--o{ wing_classes : groups
    school_classes ||--o{ wing_classes : assigned_to
    school_classes ||--o{ sections : divided_into
    sections ||--o{ student_profiles : enrolls
    users ||--o| staff_profiles : has
    users ||--o| principal_profiles : has
    timetables ||--o{ timetable_setups : configures
    timetables ||--o{ timetable_entries : schedules
    timetable_setups ||--o{ timetable_periods : defines
    timetable_setups ||--o{ timetable_setup_assignments : assigns
    sections ||--o{ timetable_setup_assignments : mapped_by
    subjects ||--o{ timetable_entries : subject_in
    users ||--o{ timetable_entries : taught_by
    timetable_periods ||--o{ timetable_entries : slot_in
    sections ||--o{ timetable_entries : class_of
```

---

## 7. Project Directory Structure & Key Files Map

```text
School-LMS/
├── SYSTEM_ARCHITECTURE.md              # THIS LIVING MASTER DOCUMENT
├── readme.md                           # Quickstart guide & local setup notes
├── Backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application factory & CORS configuration
│   │   ├── api/
│   │   │   ├── deps.py                 # Dependency injection (get_db, current_user, RBAC)
│   │   │   └── v1/
│   │   │       ├── api.py              # Main v1 router assembly
│   │   │       └── endpoints/
│   │   │           ├── timetable.py    # Timetable, Setups & Grid REST endpoints
│   │   │           ├── auth.py         # Login, JWT issuing, PIN verification
│   │   │           ├── staff.py        # Staff profile management
│   │   │           └── school_config.py# Wings, Classes, Sections, Houses
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic environment settings
│   │   │   ├── database.py             # SQLAlchemy engine & sessionmaker
│   │   │   └── exceptions.py           # Standard HTTP exception classes (409, 422, 404)
│   │   ├── models/
│   │   │   ├── timetable.py            # Timetable, TimetableSetup, TimetablePeriod, TimetableEntry
│   │   │   ├── user.py                 # Core User entity & audit fields
│   │   │   ├── staff.py                # StaffProfile & StaffWing
│   │   │   └── school_class.py         # SchoolClass, Section, WingClass
│   │   ├── schemas/
│   │   │   └── timetable.py            # Pydantic request/response schemas (BatchSetupItem, etc.)
│   │   └── services/
│   │       ├── timetable_service.py    # Core business logic for Timetable & Bell Setups
│   │       ├── bell_timing_validator.py# Sweep-Line interval validator ($O(N log N + k)$)
│   │       └── timetable_export_service.py # Excel workbook generator
│   └── tests/
│       ├── test_bell_timing.py         # 23 Automated Pytest tests for Bell Setups, OCC, Sweep-Line
│       └── test_section_teacher_independence.py # Teacher isolation verification tests
│
└── Frontend/
    ├── src/
    │   ├── api/
    │   │   └── timetableService.js     # Axios API layer for timetable endpoints
    │   ├── hooks/
    │   │   └── useTimetable.js         # React Query hooks (useClassWiseTimetable, useSetups, etc.)
    │   ├── pages/
    │   │   └── timetable/
    │   │       ├── TimeTable.jsx       # Main Timetable view orchestrator
    │   │       ├── bellTiming/         # Bell Timing Setup modal & timeline engine
    │   │       │   ├── BellTimeline.jsx# Interactive drag-and-drop timeline
    │   │       │   ├── scheduleReducer.js # Structural-sharing state manager (undo/redo)
    │   │       │   ├── timeUtils.js    # Integer minute calculations ($0..1439$)
    │   │       │   ├── validators.js   # Frontend Sweep-Line overlap validator
    │   │       │   └── __tests__/      # 60 Vitest unit tests for time math, reducer, validators
    │   │       └── components/
    │   │           ├── BellScheduleSetupModal.jsx # Multi-setup bell configuration modal
    │   │           ├── ClassWiseGridView.jsx      # Interactive weekly class schedule grid
    │   │           └── TeacherWiseGridView.jsx    # Teacher availability and schedule grid
    │   └── components/ui/              # shadcn/ui shared components (Button, Dialog, Popover)
    └── package.json                    # Dependencies & build scripts
```

---

## 8. Operational & Developer Runbook

### Starting Local Services

#### 1. Backend Server
```powershell
cd Backend
$env:PYTHONPATH="Backend"
Backend\venv\Scripts\uvicorn app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Swagger OpenAPI Documentation: `http://localhost:8000/docs`

#### 2. Frontend Development Server
```powershell
cd Frontend
npm run dev
```
- Local Application: `http://localhost:5173`

---

### Running Automated Test Suites

Both backend and frontend test suites must pass 100% before committing or deploying:

#### Backend Pytest Suite
```powershell
$env:PYTHONPATH="Backend"
Backend\venv\Scripts\python.exe -m pytest Backend/tests/test_bell_timing.py Backend/tests/test_section_teacher_independence.py
```
- **Current Metric**: **23 / 23 Passed** (Sweep-line overlap checks, optimistic concurrency conflict 409, root timetable version bumps, schema serialization).

#### Frontend Vitest Suite
```powershell
npm --prefix Frontend exec vitest run src/pages/timetable/bellTiming/__tests__/
```
- **Current Metric**: **60 / 60 Passed** (Time string parser, integer minute math, reducer structural sharing, interval validation).

#### Production Frontend Bundle Verification
```powershell
npm --prefix Frontend run build
```
- **Current Metric**: **3,520 modules transformed cleanly with 0 errors**.

---

## 9. Current Status & Active Roadmap

### Completed Milestones
- [x] **Point 1 (Dual-Storage & Minutes Math)**: Single source of truth in DB table `timetable_periods`; integer minutes math ($0 \dots 1439$).
- [x] **Point 2 (Clean API & Zero Bloat)**: Strongly typed `BatchSetupItem`; dropped duplicate JSON payload lists; eliminated 6-query post-mutation read storm; $O(1)$ section mapping lookups.
- [x] **Point 3 (Algorithmic Precision)**: Chronological $O(N \log N + k)$ Sweep-Line algorithm on backend and frontend; structural sharing in reducer state.
- [x] **Point 4 (Concurrency & Transactional Invariants)**: PostgreSQL row locks (`with_for_update()`); strict OCC (409 Conflict); root timetable aggregate locking.
- [x] **Setup Period ID Polymorphism**: `SetupPeriodItem.id` supports `Union[UUID, str]` with clean string serialization, preventing HTTP 500 response validation errors.

### Current Paused / Pending Task
- [ ] **Case 2: Cascading Lecture Impact Handling ("Chair vs. Seat Number")**:
  - *Context*: When an administrator drags, expands, shrinks, splits, or deletes a bell period in "Set Bell Timing", how should existing teacher lecture assignments scheduled in those slots behave?
  - *Scenarios to Resolve with Institutional Rules*:
    1. **Shortened Period**: Keep lecture assigned or warn about reduced teaching time?
    2. **Lengthened Period**: Keep lecture assigned?
    3. **Deleted Period**: Cascade delete lectures or move them into an unassigned holding pen?
    4. **Re-ordered / Inserted Periods**: Shift lectures with period numbers or pin them to clock time?
  - *Status*: Paused per user instruction to allow dedicated thinking time before implementation.

