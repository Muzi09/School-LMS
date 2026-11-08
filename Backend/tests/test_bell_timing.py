import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.services.bell_timing_validator import (
    parse_time_to_minutes,
    validate_period_sequence,
    validate_setup_day_invariants,
    MIN_PERIOD_DURATION_MINUTES,
    MAX_PERIOD_DURATION_MINUTES,
)
from app.core.exceptions import UnprocessableEntityException, ConflictException, BadRequestException


def test_parse_time_to_minutes():
    assert parse_time_to_minutes("08:30") == 510
    assert parse_time_to_minutes("00:00") == 0
    assert parse_time_to_minutes("23:59") == 1439
    with pytest.raises(ValueError):
        parse_time_to_minutes("25:00")
    with pytest.raises(ValueError):
        parse_time_to_minutes("invalid")


def test_validate_period_sequence_success():
    periods = [
        {"period_number": 1, "start_time": "08:30", "end_time": "09:15", "type": "CLASS", "label": "P1"},
        {"period_number": 2, "start_time": "09:15", "end_time": "10:00", "type": "CLASS", "label": "P2"},
        {"period_number": 3, "start_time": "10:00", "end_time": "10:15", "type": "RECESS", "label": "Recess"},
        {"period_number": 4, "start_time": "10:15", "end_time": "11:00", "type": "CLASS", "label": "P3"},
    ]
    errors, warnings = validate_period_sequence(periods, "Test Schedule")
    assert errors == []


def test_validate_period_sequence_overlap_and_crossing_midnight():
    # End time before start time
    periods_cross = [
        {"period_number": 1, "start_time": "23:00", "end_time": "01:00", "type": "CLASS", "label": "P1"}
    ]
    errors, _ = validate_period_sequence(periods_cross)
    assert any("must be after start time" in e for e in errors)

    # Overlapping periods
    periods_overlap = [
        {"period_number": 1, "start_time": "08:30", "end_time": "09:20", "type": "CLASS", "label": "P1"},
        {"period_number": 2, "start_time": "09:15", "end_time": "10:00", "type": "CLASS", "label": "P2"},
    ]
    errors_ol, _ = validate_period_sequence(periods_overlap)
    assert any("overlaps with" in e for e in errors_ol)


def test_validate_period_sequence_min_max_duration():
    # Less than 5 min
    p_short = [
        {"period_number": 1, "start_time": "08:30", "end_time": "08:32", "type": "CLASS", "label": "P1"}
    ]
    errs_short, _ = validate_period_sequence(p_short)
    assert any(f"minimum {MIN_PERIOD_DURATION_MINUTES} minutes" in e for e in errs_short)

    # More than 180 min
    p_long = [
        {"period_number": 1, "start_time": "08:00", "end_time": "12:00", "type": "CLASS", "label": "P1"}
    ]
    errs_long, _ = validate_period_sequence(p_long)
    assert any(f"exceeds maximum {MAX_PERIOD_DURATION_MINUTES} minutes" in e for e in errs_long)


def test_validate_period_sequence_requires_class_period():
    p_recess_only = [
        {"period_number": 1, "start_time": "08:30", "end_time": "09:00", "type": "RECESS", "label": "Recess"}
    ]
    errs, _ = validate_period_sequence(p_recess_only)
    assert any("Must have at least 1 Class period" in e for e in errs)


def test_validate_period_sequence_duplicate_labels():
    periods_dup = [
        {"period_number": 1, "start_time": "08:30", "end_time": "09:15", "type": "CLASS", "label": "P1"},
        {"period_number": 2, "start_time": "09:15", "end_time": "10:00", "type": "CLASS", "label": "P1"},
    ]
    errs, _ = validate_period_sequence(periods_dup)
    assert any("Duplicate period label" in e for e in errs)


def test_validate_setup_day_invariants():
    working_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

    # Valid
    valid_setup = {
        "name": "Setup 1",
        "schedules": [
            {"id": "s1", "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]},
            {"id": "s2", "days": ["SATURDAY"]},
        ],
    }
    assert validate_setup_day_invariants(valid_setup, working_days) == []

    # Orphaned day
    missing_day_setup = {
        "name": "Setup 1",
        "schedules": [
            {"id": "s1", "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]},
        ],
    }
    errs = validate_setup_day_invariants(missing_day_setup, working_days)
    assert any("Day 'SATURDAY' is not assigned" in e for e in errs)

    # Duplicated day
    dup_day_setup = {
        "name": "Setup 1",
        "schedules": [
            {"id": "s1", "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]},
            {"id": "s2", "days": ["SATURDAY"]},
        ],
    }
    errs_dup = validate_setup_day_invariants(dup_day_setup, working_days)
    assert any("Day 'SATURDAY' is assigned to multiple schedules" in e for e in errs_dup)


def test_unauthenticated_requests_rejected():
    client = TestClient(app)
    # GET /api/v1/timetable/setups without auth token should return 401 Unauthorized
    resp = client.get("/api/v1/timetable/setups?timetable_id=" + str(uuid4()))
    assert resp.status_code == 401


def test_service_validation_raises_422():
    from app.core.database import SessionLocal
    from app.services.timetable_service import TimetableService
    from app.schemas.timetable import BatchSetupAssignmentsRequest
    from app.models.timetable import Timetable

    db = SessionLocal()
    service = TimetableService(db=db)
    tt = db.query(Timetable).filter(Timetable.deleted_at.is_(None)).first()
    if not tt:
        db.close()
        return

    # Payload with overlapping periods
    payload = BatchSetupAssignmentsRequest(
        timetable_id=tt.id,
        setups=[
            {
                "id": None,
                "name": "Invalid Setup",
                "schedules": [
                    {
                        "id": "regular",
                        "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
                        "periods": [
                            {"period_number": 1, "start_time": "08:30", "end_time": "09:30", "type": "CLASS", "label": "P1"},
                            {"period_number": 2, "start_time": "09:00", "end_time": "10:00", "type": "CLASS", "label": "P2"},
                        ],
                    }
                ],
            }
        ],
        assignments=[],
    )
    with pytest.raises(UnprocessableEntityException) as exc_info:
        service.batch_save_setups(school_id=tt.school_id, timetable_id=payload.timetable_id, data=payload, user_id=uuid4())
    assert exc_info.value.status_code == 422
    db.close()


def test_preview_setups_impact():
    from app.core.database import SessionLocal
    from app.services.timetable_service import TimetableService
    from app.schemas.timetable import BatchSetupAssignmentsRequest

    db = SessionLocal()
    service = TimetableService(db=db)
    payload = BatchSetupAssignmentsRequest(
        timetable_id=uuid4(),
        setups=[],
        assignments=[],
    )
    res = service.preview_setups_impact(school_id=uuid4(), timetable_id=payload.timetable_id, data=payload)
    assert "affected_slots_count" in res
    assert res["affected_slots_count"] == 0
    db.close()


def test_concurrency_conflict_raises_409():
    from app.core.database import SessionLocal
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup
    from app.schemas.timetable import TimetableSetupUpdate

    db = SessionLocal()
    service = TimetableService(db=db)
    setup = db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None)).first()
    if not setup:
        db.close()
        return

    # Pass an outdated version
    outdated_version = (setup.version or 1) - 1
    update_data = TimetableSetupUpdate(
        name="Updated Name",
        version=outdated_version,
    )
    with pytest.raises(ConflictException) as exc_info:
        service.update_setup(
            school_id=setup.school_id,
            setup_id=setup.id,
            data=update_data,
            user_id=uuid4(),
        )
    assert exc_info.value.status_code == 409
    db.close()


def test_atomic_move_classes():
    from app.core.database import SessionLocal
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup, TimetableSetupAssignment
    from app.models.section import Section
    from app.schemas.timetable import MoveClassesRequest

    db = SessionLocal()
    service = TimetableService(db=db)
    from app.models.timetable import Timetable
    setups = (
        db.query(TimetableSetup)
        .join(Timetable, Timetable.id == TimetableSetup.timetable_id)
        .filter(TimetableSetup.deleted_at.is_(None), Timetable.deleted_at.is_(None))
        .limit(2)
        .all()
    )
    section = db.query(Section).filter(Section.deleted_at.is_(None)).first()
    if len(setups) < 2 or not section:
        db.close()
        return

    target_setup = setups[1]
    req = MoveClassesRequest(
        timetable_id=target_setup.timetable_id,
        target_setup_id=target_setup.id,
        section_ids=[section.id],
    )
    res = service.move_classes(
        school_id=target_setup.school_id,
        data=req,
        user_id=target_setup.created_by,
    )
    assert "Moved" in res["message"]

    # Verify assignment exists in DB
    assign = db.query(TimetableSetupAssignment).filter(
        TimetableSetupAssignment.timetable_id == target_setup.timetable_id,
        TimetableSetupAssignment.target_type == "SECTION",
        TimetableSetupAssignment.target_id == section.id,
    ).first()
    assert assign is not None
    assert assign.setup_id == target_setup.id
    db.close()


def test_duplicate_setup_independent_copy():
    from app.core.database import SessionLocal
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup

    db = SessionLocal()
    service = TimetableService(db=db)
    setup = db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None)).first()
    if not setup:
        db.close()
        return

    duplicated = service.duplicate_setup(
        school_id=setup.school_id,
        setup_id=setup.id,
        user_id=setup.created_by,
    )
    assert duplicated.id != setup.id
    assert duplicated.name == f"Copy of {setup.name}"

    # Clean up duplicated setup
    db.delete(duplicated)
    db.commit()
    db.close()


def test_migration_schema_and_idempotency():
    from app.core.database import engine
    from sqlalchemy import inspect

    inspector = inspect(engine)
    setup_cols = {col["name"] for col in inspector.get_columns("timetable_setups")}
    assert "version" in setup_cols
    assert "order_index" in setup_cols
    assert "schedules_json" in setup_cols

    period_cols = {col["name"] for col in inspector.get_columns("timetable_periods")}
    assert "schedule_id" in period_cols
    assert "period_type" in period_cols

