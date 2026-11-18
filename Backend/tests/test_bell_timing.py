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

    # Multi-period non-adjacent overlap caught by Sweep-Line
    periods_multi = [
        {"period_number": 1, "start_time": "08:30", "end_time": "10:30", "type": "CLASS", "label": "Block"},
        {"period_number": 2, "start_time": "08:45", "end_time": "09:15", "type": "CLASS", "label": "P1"},
        {"period_number": 3, "start_time": "09:30", "end_time": "10:00", "type": "CLASS", "label": "P2"},
    ]
    errs_multi, _ = validate_period_sequence(periods_multi)
    assert any("Block" in e and "P1" in e for e in errs_multi)
    assert any("Block" in e and "P2" in e for e in errs_multi)

    # Out of chronological order periods
    periods_ooo = [
        {"period_number": 2, "start_time": "10:00", "end_time": "10:45", "type": "CLASS", "label": "P2"},
        {"period_number": 1, "start_time": "09:30", "end_time": "10:15", "type": "CLASS", "label": "P1"},
    ]
    errs_ooo, _ = validate_period_sequence(periods_ooo)
    assert any("overlaps with" in e for e in errs_ooo)


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


def test_service_validation_raises_422(db, school):
    from app.services.timetable_service import TimetableService
    from app.schemas.timetable import BatchSetupAssignmentsRequest
    from app.models.timetable import Timetable

    service = TimetableService(db=db)
    tt = db.query(Timetable).filter(Timetable.deleted_at.is_(None)).first()
    assert tt is not None

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


def test_preview_setups_impact(db, school):
    from app.services.timetable_service import TimetableService
    from app.schemas.timetable import BatchSetupAssignmentsRequest

    service = TimetableService(db=db)
    timetable = service.get_active_timetable(school.id)
    payload = BatchSetupAssignmentsRequest(
        timetable_id=timetable.id,
        setups=[],
        assignments=[],
    )
    res = service.preview_setups_impact(school_id=school.id, timetable_id=payload.timetable_id, data=payload)
    assert "affected_slots_count" in res
    assert res["affected_slots_count"] == 0


def test_concurrency_conflict_raises_409(db, school):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup
    from app.schemas.timetable import TimetableSetupUpdate

    service = TimetableService(db=db)
    setup = db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None)).first()
    assert setup is not None

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
    db.rollback()


def test_setup_update_waits_for_the_timetable_root(migrated_db):
    from sqlalchemy import delete, select, text
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session

    from app.models import School
    from app.models.timetable import TimetableSetup
    from app.schemas.timetable import TimetableSetupUpdate
    from app.services.timetable_service import TimetableService

    with Session(migrated_db) as writer, Session(migrated_db) as concurrent:
        school = School(name="Synthetic lock fixture", code=f"LOCK-{uuid4().hex[:8]}", setup_completed=True)
        writer.add(school)
        writer.commit()
        school_id = school.id
        try:
            service = TimetableService(writer)
            timetable_id = service.get_active_timetable(school_id).id
            setup_id = writer.scalar(select(TimetableSetup.id).where(TimetableSetup.timetable_id == timetable_id))
            assert setup_id is not None
            service._lock_timetable(school_id, timetable_id)

            concurrent.execute(text("SET LOCAL lock_timeout = '300ms'"))
            with pytest.raises(OperationalError) as blocked:
                TimetableService(concurrent).update_setup(
                    school_id, setup_id, TimetableSetupUpdate(name="Edited", version=1), uuid4(),
                )
            assert blocked.value.orig.sqlstate == "55P03"
        finally:
            concurrent.rollback()
            writer.rollback()
            writer.execute(delete(School).where(School.id == school_id))
            writer.commit()


def test_batch_save_concurrency_conflict_raises_409(db, school):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup, Timetable
    from app.schemas.timetable import BatchSetupAssignmentsRequest

    service = TimetableService(db=db)
    setup = (
        db.query(TimetableSetup)
        .join(Timetable, Timetable.id == TimetableSetup.timetable_id)
        .filter(TimetableSetup.deleted_at.is_(None), Timetable.deleted_at.is_(None))
        .first()
    )
    assert setup is not None

    # Pass an outdated version for the setup in batch save
    stale_version = (setup.version or 1) - 1
    payload = BatchSetupAssignmentsRequest(
        timetable_id=setup.timetable_id,
        setups=[
            {
                "id": str(setup.id),
                "name": setup.name,
                "version": stale_version,
                "schedules": [
                    {
                        "id": "regular",
                        "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
                        "periods": [
                            {"period_number": 1, "start_time": "08:30", "end_time": "09:15", "type": "CLASS", "label": "P1"},
                        ],
                    }
                ],
            }
        ],
        assignments=[],
    )
    with pytest.raises(ConflictException) as exc_info:
        service.batch_save_setups(
            school_id=setup.school_id,
            timetable_id=setup.timetable_id,
            data=payload,
            user_id=uuid4(),
        )
    assert exc_info.value.status_code == 409
    assert "has been modified by another user" in str(exc_info.value.message)
    db.rollback()


def test_aggregate_timetable_version_bumping(db, school):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import Timetable

    service = TimetableService(db=db)
    tt = db.query(Timetable).filter(Timetable.deleted_at.is_(None)).first()
    assert tt is not None

    prev_version = tt.version or 1
    touched = service._touch_timetable(school_id=tt.school_id, timetable_id=tt.id, user_id=uuid4())
    db.commit()
    db.refresh(tt)
    assert tt.version == prev_version + 1


def test_atomic_move_classes(db, school, school_actor):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup, TimetableSetupAssignment
    from app.models.section import Section
    from app.schemas.timetable import MoveClassesRequest

    service = TimetableService(db=db)
    original = db.query(TimetableSetup).filter(TimetableSetup.school_id == school.id).one()
    target_setup = service.duplicate_setup(school.id, original.id, school_actor.id)
    section = db.query(Section).filter(Section.school_id == school.id, Section.deleted_at.is_(None)).one()
    req = MoveClassesRequest(
        timetable_id=target_setup.timetable_id,
        target_setup_id=target_setup.id,
        section_ids=[section.id],
    )
    res = service.move_classes(
        school_id=target_setup.school_id,
        data=req,
        user_id=school_actor.id,
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


def test_duplicate_setup_independent_copy(db, school):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import TimetableSetup

    service = TimetableService(db=db)
    setup = db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None)).first()
    assert setup is not None

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


def test_migration_schema_and_idempotency(migrated_db):
    from sqlalchemy import inspect

    inspector = inspect(migrated_db)
    setup_cols = {col["name"] for col in inspector.get_columns("timetable_setups")}
    assert "version" in setup_cols
    assert "order_index" in setup_cols
    assert "schedules_json" in setup_cols

    period_cols = {col["name"] for col in inspector.get_columns("timetable_periods")}
    assert "schedule_id" in period_cols
    assert "period_type" in period_cols


def test_string_period_id_in_schemas():
    from app.schemas.timetable import ConflictCheckRequest, BulkSlotAssignRequest
    from uuid import uuid4

    # String period IDs such as p-3-1794130451420 must be valid in request schemas
    req = ConflictCheckRequest(
        timetable_id=uuid4(),
        teacher_user_id=uuid4(),
        day_of_week="MONDAY",
        period_id="p-3-1794130451420",
    )
    assert req.period_id == "p-3-1794130451420"

    bulk_req = BulkSlotAssignRequest(
        timetable_id=uuid4(),
        section_id=uuid4(),
        day_of_week="MONDAY",
        period_id="p-3-1794130451420",
        subject_id=uuid4(),
        scope="WEEKDAYS",
        apply_days=["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"],
    )
    assert bulk_req.period_id == "p-3-1794130451420"
    assert bulk_req.apply_days == ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"]


def test_setup_period_item_accepts_uuid_and_string():
    from app.schemas.timetable import SetupPeriodItem
    from uuid import uuid4

    # Must accept UUID without error
    uid = uuid4()
    p1 = SetupPeriodItem(
        id=uid,
        period_number=1,
        start_time="08:00",
        end_time="08:45",
        period_type="CLASS",
    )
    assert p1.id == uid
    dump1 = p1.model_dump(mode="json")
    assert dump1["id"] == str(uid)

    # Must accept string without error
    p2 = SetupPeriodItem(
        id="p-temp-1",
        period_number=2,
        start_time="08:45",
        end_time="09:30",
    )
    assert p2.id == "p-temp-1"


def test_class_wise_and_setups_response_models(db, school):
    from app.services.timetable_service import TimetableService
    from app.models.timetable import Timetable
    from app.schemas.timetable import ClassWiseTimetableResponse, TimetableSetupRead
    from pydantic import TypeAdapter

    service = TimetableService(db=db)
    tt = db.query(Timetable).filter(Timetable.deleted_at.is_(None)).first()
    assert tt is not None

    # Verify get_class_wise_timetable serializes against ClassWiseTimetableResponse
    res = service.get_class_wise_timetable(school_id=tt.school_id, timetable_id=tt.id)
    validated = ClassWiseTimetableResponse.model_validate(res)
    assert validated.timetable.id == tt.id

    # Verify list_setups serializes against List[TimetableSetupRead]
    setups = service.list_setups(school_id=tt.school_id, timetable_id=tt.id)
    adapter = TypeAdapter(list[TimetableSetupRead])
    validated_setups = adapter.validate_python(setups)
    assert len(validated_setups) == len(setups)
