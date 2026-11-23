from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import create_access_token
from app.main import app
from app.models import School, SchoolClass, Section, Subject
from app.models.subject import ClassSubject
from app.models.timetable import TimetableEntry, TimetablePeriod
from app.services.timetable_service import TimetableService


def test_room_inheritance_migration_review_and_school_scope(db, school, school_actor):
    timetable = TimetableService(db).get_active_timetable(school.id)
    a = db.query(Section).filter_by(school_id=school.id).one()
    a.single_room = False
    b = Section(school_id=school.id, class_id=a.class_id, name="B", single_room=False)
    music = Subject(school_id=school.id, name="Music")
    ai = Subject(school_id=school.id, name="AI")
    other = School(name="Other school", code=uuid4().hex[:12])
    db.add_all([b, music, ai, other])
    db.flush()
    foreign_class = SchoolClass(school_id=other.id, name="Other class")
    db.add(foreign_class)
    db.flush()
    foreign = Section(school_id=other.id, class_id=foreign_class.id, name="A")
    db.add(foreign)
    for sub in (music, ai):
        db.add(ClassSubject(school_id=school.id, class_id=a.class_id, subject_id=sub.id))
    period = db.query(TimetablePeriod).filter_by(timetable_id=timetable.id, is_break=False).first()
    for day, sub, room in [("MONDAY", ai, " Lab-1 "), ("TUESDAY", ai, "Lab-1"),
                           ("FRIDAY", music, "Music Hall"), ("SATURDAY", music, "B-12")]:
        db.add(TimetableEntry(school_id=school.id, timetable_id=timetable.id, section_id=a.id,
                              subject_id=sub.id, period_id=period.id, day_of_week=day, room_number=room))
    timetable.lecture_plan = {"groups": {"group": {"options": [
        {"subject_id": str(ai.id), "section_ids": [str(b.id), str(foreign.id)], "room_number": "Lab-2"}
    ]}}, "placements": {}}
    db.flush()
    path = Path(__file__).resolve().parents[1] / "alembic/versions/c9d0e1f2a3b4_section_rooms.py"
    spec = spec_from_file_location("section_room_migration", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(db.connection())):
        migration.migrate_labels()
    db.expire_all()

    def entries():
        data = TimetableService(db).get_class_wise_timetable(school.id, timetable.id)
        return {e["day_of_week"]: e["room_number"] for e in data["entries"]}

    assert entries() == {"MONDAY": "Lab-1", "TUESDAY": "Lab-1", "FRIDAY": "Music Hall", "SATURDAY": "B-12"}
    assert db.query(ClassSubject).filter_by(section_id=b.id, subject_id=ai.id).one().room_override == "Lab-2"
    assert db.query(ClassSubject).filter_by(section_id=foreign.id).count() == 0
    headers = {"Authorization": f"Bearer {create_access_token({'sub': str(school_actor.id)})}"}
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app, base_url="http://localhost:5173") as client:
            school_path = "/api/v1/school"
            section_url = f"{school_path}/sections/{a.id}"
            subject_path = lambda subject: f"{section_url}/subjects/{subject.id}/room"
            def save(url, value):
                return client.put(url, headers=headers, json={"room_number": value})

            assert client.put(section_url + "/room", json={"room_number":"204"}).status_code == 401
            assert save(f"{school_path}/sections/{foreign.id}/room", "204").status_code == 404
            assert save(f"{section_url}/subjects/{uuid4()}/room", "204").status_code == 404
            assert save(section_url + "/room", "x" * 17).status_code == 422
            assert save(section_url + "/room", " 204 ").status_code == 200
            config = client.get(school_path + "/config", headers=headers).json()
            section = next(s for c in config["classes"] for s in c["sections"] if s["id"] == str(a.id))
            assert section["room_number"] == "204"
            assert section["room_overrides"][str(ai.id)] == "Lab-1"
            assert section["room_reviews"][str(music.id)]["labels"] == ["B-12", "Music Hall"]
            assert save(subject_path(music), " Studio-1 ").status_code == 200
            assert entries()["SATURDAY"] == entries()["FRIDAY"] == "Studio-1"
            assert not a.room_reviews
            mode_path = section_url + "/room-mode"
            assert client.put(mode_path, headers=headers, json={"single_room": True}).status_code == 200
            assert set(entries().values()) == {"204"}
            assert save(subject_path(ai), "Lab-2").status_code == 409
            assert client.put(mode_path, headers=headers, json={"single_room": False}).status_code == 200
            assert entries()["MONDAY"] == "Lab-1"
            assert entries()["FRIDAY"] == "Studio-1"
            assert save(subject_path(ai), "   ").status_code == 200
            assert entries()["MONDAY"] == "204"
            assert save(section_url + "/room", None).status_code == 200
            assert entries()["MONDAY"] is None
            assert entries()["FRIDAY"] == "Studio-1"
            assert save(f"{school_path}/sections/{b.id}/subjects/{music.id}/room", "Studio-1").status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)
