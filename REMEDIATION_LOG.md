# School LMS remediation log

Branch `Bugs-fixed`, based on `4857de141f386cb9efcd67003b729b3b6d70ad23`. Finding IDs match the production-readiness audit. Work proceeded from release blockers through high, medium and low severity findings.

## Release blockers

- **SEC-001** — Removed the identity-header fallback. REST and WebSocket authentication resolve the verified account and require an active user. Added unauthenticated coverage.
- **SEC-002** — Applied school and role scopes to student roster queries, ID lookup, edits, status changes and deletion. PostgreSQL tests check anonymous requests, role mismatch and school isolation on roster reads and writes.
- **SEC-003** — Removed `Backend/.env` from Git tracking and kept the ignored local file. Made first-administrator setup interactive and limited password rotation to existing administrators. Compose requires a database URL, PostgreSQL password and signing secret. Previously committed credentials require operator rotation.

## High severity

- **SEC-004** — Applied school and role scopes to staff ID lookup, edits, status, deletion and invitation resend. Academic wing assignments accept only active wings in the caller’s school. The integration tests check the staff permission boundary.
- **SEC-005** — Configured Caddy HTTPS, security headers and private Compose networking for the API and database. Compose requires a public hostname. CI defines a container and HTTPS smoke test.
- **SEC-006** — Added PostgreSQL-backed sign-in counters per normalized account and client address. The limit is shared across workers. PIN-only sign-in returns HTTP 410. The onboarding forms now create passwords only. Legacy PIN hash columns remain for schema compatibility.
- **SEC-007** — Restricted SMTP to configured hosts, encrypted port and protocol pairs, and public DNS answers. Outbound connections use a checked address and verify TLS against the provider hostname.
- **SEC-008** — Removed SMTP passwords from responses, added a separate Fernet key and put new ciphertext in a versioned envelope. Mail settings request a replacement password for configurations that used the prior encryption.
- **SEC-009** — Built onboarding and staff invitation URLs from the configured public frontend origin. Browser authentication checks explicit allowed origins.
- **SEC-010** — Browser sign-in returns an opaque HttpOnly cookie. PostgreSQL stores only its hash. Unsafe cookie-authenticated requests check Origin. Sign-out revokes the session. The browser no longer stores bearer tokens or puts credentials in WebSocket URLs. API clients can still request short-lived bearer tokens.
- **SEC-011** — Pinned SheetJS 0.20.3 to the vendor distribution. Updated the flagged Axios transitive dependency `follow-redirects` to 1.16.3. The lockfile records package integrity. [SheetJS installation documentation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- **SEC-012** — Built timetable print markup with DOM text and node imports so stored names and labels are rendered as text.
- **PRI-001** — Scoped student query keys by school and user. Added query-cache clearing on identity changes, session restore and sign-out. Tabs synchronize login and logout with BroadcastChannel. Onboarding drafts use tab-local session storage. PostgreSQL tests cover the session contract and revocation.
- **DAT-001** — Validated the exact section set, target scope, setup IDs and duplicate assignments before writes. Added a composite foreign key for new or updated mappings. Scoped timetable copying and impact preview to the same school. Historical assignment validation remains a release step.
- **DAT-002** — Converted legacy migration backfills to SQL that works online and offline. Added rollback guards for schedule data, overlapping teacher slots and student audit data. Verified offline SQL generation from base to head and online migration against disposable PostgreSQL. The runbook covers backup and restoration.
- **COR-001** — Locked the timetable root before validating and publishing. The publish request now sends the reviewed draft version, the transaction advances it, and a stale request gets HTTP 409. Entry, setup, batch and teacher-assignment mutations advance the draft version. Tested mutation-before-publish and retry-after-publish.
- **COR-002** — Qualified roll calculations and renumbering by school and normalized section. Retained a school-scoped label fallback for unmatched historical profiles. Serialized roster writes through a school row lock and used a deterministic alphabetical order. Roll numbers remain derived and may change after roster edits.
- **COR-003** — Standardized root-before-child lock ordering, including schedule updates and batch saves. Mapped retryable PostgreSQL failures to HTTP 409. A two-connection test verifies that a direct setup update waits for the root lock.
- **REL-001** — Capped inbound request size in Caddy, workbook compressed and expanded size, sheet dimensions and record count. Workbook XML uses `defusedxml`. Emblem uploads are read with a byte cap, validated, resized and re-encoded as static PNG.
- **ARC-001** — Moved period normalization to one writer and removed hidden commits in the default setup factory and period resolution in read paths. Preserved period types during duplication and reconciled lessons against their day schedules. A save that would strand a lesson returns a conflict and preserves the prior configuration.
- **TST-001** — Added isolated PostgreSQL fixtures, upgrade checks and rollback between tests. Integration cases now require seeded records and assert observable behavior, including actual class reassignment.

## Medium severity

- **API-001** — Existing setup updates require a saved version. The web editor sends the timetable version held when it opens. Batch removal checks that version, and the UI preserves edits on conflict.
- **PER-001** — Added bounded administrator pagination and eager school loading. Latest onboarding tokens are selected as a batch. The administrator UI fetches one page at a time. Legacy list routes still return an array of up to 100 items.
- **PER-002** — Added lazy route and layout loading. The staff page loads SheetJS only when it generates a spreadsheet. Upload structure is validated by the bounded server parser.
- **REL-002** — Reused a client message ID for retries across WebSocket and REST. PostgreSQL uniqueness and conversation locking prevent duplicate persistence. The integration test retries a message and checks the stored result.
- **REL-003** — Added Redis pub/sub delivery and expiring presence leases across workers. Each socket revalidates its session, and clients reconcile messages from PostgreSQL after reconnecting. Worker startup waits for Redis to confirm its subscription, and losing one WebSocket can no longer stop delivery to other sockets. CI runs the two-worker delivery and presence test against Redis 7.4.
- **UX-001** — Named timetable assignment cells and added keyboard activation. Enter opens an assignment and Space selects its cell. Selection works with the existing keyboard copy, paste and clear shortcuts. Added a component regression test.
- **UX-002** — Used `Intl` and the browser locale and timezone for chat dates, with English and Hindi last-seen prefixes. Preserved local wall-clock time in the school timetable. Added localized and date-boundary assertions.
- **DEV-001** — Pinned Python runtime dependencies, the CI and container Python version, and the frontend Node version. Added headless testing, coverage, build and dependency scans to CI. Cleared frontend lint findings and made lint and scoped strict JavaScript type checking release gates. Broader component type checking remains open.
- **DEV-002** — The web image builds its own frontend artifact. A dedicated Compose service migrates the database before the backend starts. Added an isolated CI release smoke job that builds images and checks readiness and the bundle over HTTPS.
- **PRI-002** — Minimized the roster, audited individual detail access and exposed authorized export in the detail dialog. Added a school-scoped erasure command with dry-run, retention cutoff, approval reference and hold confirmation. Each school must supply its approved retention and hold policy.
- **QLT-001** — Extracted bounded workbook reading, assignment validation, period normalization, section-subject statistics, the interval conflict counter and teacher-assignment warnings. Reduced branching in the named scheduling paths. The remaining service methods still warrant incremental refactoring.
- **TST-002** — Corrected the explicit Save test to observe a successful save and added a conflict test that exercises keeping and discarding edits.

## Low severity

- **ARC-002** — Corrected the architecture’s router, chat tables, student placement, session and timetable descriptions. Added a school-scoped placement migration and a release and student-record operations runbook.

## Verification

- PostgreSQL 16.15 with Python 3.14.2 — 34 backend tests passed with a disposable database and loopback Redis-protocol fixture. The full migration chain was applied to a fresh database during verification.
- Alembic — generated and applied offline SQL for all nine revisions. A downgrade attempt against a populated test database was rejected and rolled back without losing the edited setup or current schema.
- Python dependency audit — no known vulnerabilities reported for the resolved runtime requirements.
- Node 24.15.0 — 86 frontend tests and the standalone chat-date suite passed. The production bundle uses separate route and spreadsheet chunks. The staff chunk dropped from about 570 kB to 80 kB minified when spreadsheet generation moved to a dynamic import.
- npm production dependency audit — no known vulnerabilities reported.
- Full frontend lint — reduced from 227 errors and 18 warnings to zero. CI runs with `--max-warnings=0`. The scoped strict TypeScript check also passed.
- `git diff --check` passed after whitespace cleanup.

## Release work

- Rotate every exposed credential in its actual environment, including the JWT secret and database credentials. Revoke any affected sessions. Coordinate any Git history rewrite with the repository owner.
- Generate a dedicated SMTP encryption key and re-enter rotated provider passwords where used. Validate real SMTP delivery with the intended sender.
- Use the CI release smoke job or staging to run the full Docker stack. Verify public TLS, live cross-worker chat, and the backup/restore runbook before a release.
- Review historical timetable mappings before validating the new foreign key, and review any students whose historical placement did not match a configured section.
- Have each school approve its student retention, authorization and hold rules before applying any erasure case. No production erasures were performed.

## Follow-up on frontend verification

- Removed unused imports and declarations. Separated the auth, theme, sidebar and timetable tooltip state from their React components so Fast Refresh uses component-only modules. Excluded generated coverage output from lint.
- Reworked timetable and school setup state to avoid stale callbacks and redundant updates. School setup reads the onboarding draft from tab storage when the invite opens. Timetable assignment checks show the current slot’s result. The timetable selector now renders its activation confirmation and passes the pending state to its delete dialog.
- Restored student-management actions for principals and aligned the staff UI with the API’s read-only roster permission. Added regression checks for student permissions and the timetable assignment dialog.
- Added strict, headless JavaScript type checking for permission, date and time, download, and validation-pattern modules. The verification workflow requires frontend lint and this type check. Broader component type checking remains open.
- Caddy 2.11.9 accepted the production Caddyfile. A loopback HTTPS smoke test served the built frontend, verified SPA fallback and HSTS, and routed a readiness request to a synthetic upstream. Public certificates and the full Docker, SMTP, and Redis deployment remain release checks.

## Follow-up on API and chat verification

- Matched the browser API client’s return types to the response bodies it returns. Added separate contracts for the student roster and student details, and made optional shared-component props explicit. The strict auth, staff and student API checks pass. The production-source check (`npm run typecheck:all`) dropped from 664 to 404 diagnostics in that pass.
- Fixed staff invitations displaying no name or school despite a successful response. The setup request now sends only the invitation token and password. Tests cover the displayed invitation identity, API error details, and session-expiry notifications.
- Verified that two chat connection managers receive events through the same loopback Redis-protocol fixture, keep a user online while another socket is open, and send presence only to that user's school. The CI job uses a Redis server for the same test. Real deployment and provider checks remain in the release work above.
- Added a synthetic SMTP encryption test that reads credentials after the JWT signing key changes and verifies that legacy ciphertext requires reconfiguration.


## Full frontend type-check remediation

- Priority 1, API and mutation contracts. Typed the roster, user, timetable, school configuration, and admin mutations so their callbacks share the same variables as the API calls. Matched school-management error handling to the normalized client error and typed the WebSocket callbacks and user filters.
- Checkpoint 1. The full frontend check fell from 404 to 271 diagnostics.
- Priority 2, shared UI contracts. Marked optional props on inputs, pickers, headings, dialogs, and sidebar controls. Typed the table's controlled state and the student, staff, and SMTP form values. After the shared prop fixes, the full check reported 177 diagnostics.
- Priority 3, timetable and browser contracts. Typed timetable requests, slot callbacks, grid data, and print props. Removed obsolete props from timetable and school setup callers. Made date sorting numeric and narrowed browser event and file-reading values at their use sites. The next checkpoint reported 43 diagnostics.
- Priority 4, remaining UI and export contracts. Aligned variants, overlay placement, popover triggers, sidebar and theme props with their underlying components. Removed unused filters from the timetable grid and corrected the class badge variant.
- Fixed timetable Excel export to return the response body from the API client. The added regression test checks that the workbook blob reaches the caller intact.
- The final full frontend type check reported zero diagnostics, down from 404 at the start of this follow-up. Added the full check to the verification workflow alongside the scoped strict check.
- Local verification on Node 24.15.0 passed the scoped strict and full frontend type checks, ESLint with zero warnings, all 87 Vitest tests, the standalone chat-date check, and the Vite production build.
