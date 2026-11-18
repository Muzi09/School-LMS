# Release operations

Use Python 3.14.2, Node 24.15.0 and PostgreSQL 16, as configured in the verification workflow and container builds. Prepare the environment from `.env.production.example` outside Git. Keep deploy credentials in the deployment secret store. For a new installation, create the first administrator using `python -m app.seed.create_admin` in the backend environment. The command prompts for the password.

## Rollout and rollback

1. Record the release commit. Build both images from that commit. Caddy serves the frontend compiled into the web image.
2. Before migration, take a PostgreSQL backup and snapshot the uploads volume. Restore both into an isolated staging environment and verify the starting revision. Run `python -m alembic upgrade head --sql` to inspect the migration statements.
3. Run one migration job before replacing the backend service. `docker compose up -d --build` orders the `migrate`, `backend` and `caddy` services. Confirm the job exits successfully and `/health/ready` returns HTTP 200. Confirm HTTPS and the configured public origin, then check sign-in, a school roster, a timetable save and publish, and message delivery between workers.
4. Review historical `student_profiles` with missing `section_id` and a populated class and section. Fix placement through the school’s roster workflow. Check `timetable_setup_assignments` against the owning setup and target before validating `fk_timetable_setup_assignment_owner` in PostgreSQL. Resolve confirmed mismatches with each school before altering its data.
5. When timetable data uses multiple schedules, relaxed teacher slots or a newer audit schema, the older schema can reject or discard data. The guarded downgrades stop when their preconditions fail. Prefer a forward correction. To revert the schema, stop writes and restore the verified pre-release database and upload snapshots, deploy the corresponding previous images, and check the restored revision and application. Reconcile writes made after the backup according to the incident plan.

Changing the browser session mechanism requires staff and principals to sign in again. Use same-site web and API hosts with an explicitly allowed application origin. Rotate every credential previously tracked in Git and revoke any active browser sessions and bearer tokens as part of the incident response. If SMTP is configured, rotate provider credentials, generate a dedicated `SMTP_ENCRYPTION_KEY` and re-enter the new password through email settings. Redis needs to be reachable by each worker on a private network. Clients reload recent messages from PostgreSQL after reconnecting.

## Timetable and chat clients

- Publish reads `current_version` from `GET /api/v1/timetable/timetables/{id}/publish-diff`. Pass it as `expected_version` when posting to the `publish` endpoint, and fetch a new preview after HTTP 409.
- Existing bell setups must carry their saved version when edited. The web editor also sends the timetable version from when it opened.
- Chat timestamps represent UTC instants on the wire. The UI uses the browser’s configured timezone and locale. The school’s schedule uses local wall-clock times entered by the school. Chat date labels use the browser language and the last-seen prefix has English and Hindi translations.
- The backend CI job runs chat delivery and presence tests against Redis. To run the same tests locally, point `LMS_TEST_REDIS_URL` at a disposable Redis instance on loopback and run `python -m pytest tests/test_chat_connection_manager.py` from `Backend`.

## Student records

The ordinary school roster excludes student contact details, dates of birth and parent names. Users with student-management permissions can view or download an individual record. The school can investigate access and exports using `student_record_events`, which logs IDs, action and time without duplicating contact or family fields.

Each school should record its approved purpose, collection authority or guardian authorization where applicable, retention cutoff and any legal holds in its privacy case system. A soft-deleted record is inaccessible through normal roster APIs. For an approved erasure, verify the requester and record scope, obtain the retention cutoff and hold decision, then run `python -m app.seed.erase_student SCHOOL_UUID STUDENT_UUID --approval-reference CASE_ID --deleted-before UTC_CUTOFF` from the backend environment. This checks eligibility without applying a deletion. After approval, append `--apply --confirm-no-hold`. The command operates on one school and student, records the opaque case reference, and rolls back if the record is still referenced.

Track separately any exports, downstream copies, and database or upload backups. Restrict access to backups, expire them under the approved retention schedule, and replay completed erasure cases before making a restored backup accessible. The school’s privacy team owns decisions about collection authority, authorization, retention and holds.
