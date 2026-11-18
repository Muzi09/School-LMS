from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import Gender, PrincipalProfile, School, StaffProfile, StudentProfile, User, UserRole
from app.models.student_record_event import StudentRecordEvent

ORIGIN = "http://localhost:5173"


def _user(db, role, school_id, name, password_hash=None):
    uid = uuid4()
    user = User(
        id=uid, first_name=name, last_name="Example", email=f"{uid.hex}@example.com",
        login_mobile=str(uid.int)[-15:], role=role, is_active=True, password_hash=password_hash,
    )
    db.add(user)
    db.flush()
    profile_data = {"user_id": uid, "school_id": school_id}
    if role == UserRole.PRINCIPAL:
        db.add(PrincipalProfile(**profile_data, school_setup_completed=True))
    elif role == UserRole.STUDENT:
        db.add(StudentProfile(
            **profile_data, roll_no="20", gender=next(iter(Gender)), date_of_birth=date(2012, 1, 1),
            class_name="Grade 6", section="A", house="Green", father_first_name="Parent", father_last_name="Example",
        ))
    elif role == UserRole.STAFF:
        db.add(StaffProfile(**profile_data, roll_no="STAFF-1", status="ACTIVE", gender=next(iter(Gender)), date_of_birth=date(1980, 1, 1)))
    db.flush()
    return user


def _client(db):
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    return TestClient(app, base_url=ORIGIN)


def test_school_rosters_and_mutations_are_scoped(db, school):
    other = School(name="Second school", code=f"OTHER-{uuid4().hex[:8]}", setup_completed=True)
    db.add(other)
    db.flush()
    principal = _user(db, UserRole.PRINCIPAL, school.id, "Principal")
    own_student = _user(db, UserRole.STUDENT, school.id, "Zoe")
    other_student = _user(db, UserRole.STUDENT, other.id, "Zoe")
    own_staff = _user(db, UserRole.STAFF, school.id, "Teacher")
    other_staff = _user(db, UserRole.STAFF, other.id, "Teacher")
    headers = {"Authorization": f"Bearer {create_access_token({'sub': str(principal.id)})}"}
    client = _client(db)
    try:
        for collection, local, different in (
            ("students", own_student, other_student),
            ("staff", own_staff, other_staff),
        ):
            root = f"/api/v1/{collection}"
            assert client.get(root).status_code == 401
            roster = client.get(root, headers=headers)
            assert roster.status_code == 200
            assert {item["id"] for item in roster.json()["items"]} == {str(local.id)}
            assert client.get(f"{root}/{local.id}", headers=headers).status_code == 200
            assert client.get(f"{root}/{different.id}", headers=headers).status_code == 404
            assert client.put(f"{root}/{different.id}", json={"first_name": "Changed"}, headers=headers).status_code == 404
            assert client.patch(f"{root}/{different.id}/status", json={"is_active": False}, headers=headers).status_code == 404
            assert client.delete(f"{root}/{different.id}", headers=headers).status_code == 404

        assert client.patch(f"/api/v1/students/{own_staff.id}/status", json={"is_active": False}, headers=headers).status_code == 404
        assert client.post(f"/api/v1/staff/{other_staff.id}/resend-setup", headers=headers).status_code == 404
        updated = client.put(f"/api/v1/students/{own_student.id}", json={"first_name": "Amy"}, headers=headers)
        assert updated.status_code == 200
        assert updated.json()["student_profile"]["roll_no"] == "1"
        assert other_student.student_profile.roll_no == "20"
        roster_item = client.get("/api/v1/students", headers=headers).json()["items"][0]
        assert {"email", "login_mobile"}.isdisjoint(roster_item)
        assert {"date_of_birth", "father_first_name"}.isdisjoint(roster_item["student_profile"])
        staff_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(own_staff.id)})}"}
        export_path = f"/api/v1/students/{own_student.id}/export"
        assert client.get(export_path, headers=staff_headers).status_code == 403
        assert client.get(f"/api/v1/students/{other_student.id}/export", headers=headers).status_code == 404
        exported = client.get(export_path, headers=headers)
        assert exported.status_code == 200
        assert exported.headers["cache-control"] == "no-store"
        assert exported.json()["id"] == str(own_student.id)
        events = db.query(StudentRecordEvent).filter_by(school_id=school.id, student_id=own_student.id).all()
        assert {event.action for event in events} >= {"detail_viewed", "exported"}
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_browser_session_is_opaque_and_revoked_on_sign_out(db, school):
    password = "synthetic integration test password"
    principal = _user(db, UserRole.PRINCIPAL, school.id, "Principal", hash_password(password))
    client = _client(db)
    try:
        assert client.post("/api/v1/auth/quick-login").status_code == 410
        login = client.post(
            "/api/v1/auth/login", json={"email": principal.email, "password": password},
            headers={"Origin": ORIGIN, "X-LMS-Session": "browser"},
        )
        assert login.status_code == 200
        assert "access_token" not in login.json()
        assert "HttpOnly" in login.headers["set-cookie"]
        assert client.get("/api/v1/auth/me").json()["id"] == str(principal.id)
        assert client.post("/api/v1/auth/logout").status_code == 403
        assert client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN}).status_code == 204
        assert client.get("/api/v1/auth/me").status_code == 401
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_chat_rest_retry_returns_the_same_message(db, school, school_actor):
    staff = _user(db, UserRole.STAFF, school.id, "Colleague")
    headers = {"Authorization": f"Bearer {create_access_token({'sub': str(school_actor.id)})}"}
    client = _client(db)
    try:
        conversation = client.post("/api/v1/chat/conversations", json={"user_id": str(staff.id)}, headers=headers)
        assert conversation.status_code == 201
        url = f"/api/v1/chat/conversations/{conversation.json()['id']}/messages"
        message = {"content": "Synthetic retry check", "client_message_id": str(uuid4())}
        first = client.post(url, json=message, headers=headers)
        retry = client.post(url, json=message, headers=headers)
        assert first.status_code == retry.status_code == 201
        assert first.json()["id"] == retry.json()["id"]
        assert [stored["id"] for stored in client.get(url, headers=headers).json()["messages"]] == [first.json()["id"]]
    finally:
        app.dependency_overrides.clear()
        client.close()


def test_publish_requires_the_reviewed_draft_version(db, school, school_actor):
    from app.services.timetable_service import TimetableService

    service = TimetableService(db)
    timetable = service.get_active_timetable(school.id)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': str(school_actor.id)})}"}
    client = _client(db)
    url = f"/api/v1/timetable/timetables/{timetable.id}"
    try:
        reviewed = client.get(f"{url}/publish-diff", headers=headers).json()["current_version"]
        service._touch_timetable(school.id, timetable.id, school_actor.id)
        db.commit()
        stale = client.post(f"{url}/publish", params={"expected_version": reviewed}, headers=headers)
        assert stale.status_code == 409
        current = client.get(f"{url}/publish-diff", headers=headers).json()["current_version"]
        success = client.post(f"{url}/publish", params={"expected_version": current}, headers=headers)
        assert success.status_code == 200
        assert client.post(f"{url}/publish", params={"expected_version": current}, headers=headers).status_code == 409
    finally:
        app.dependency_overrides.clear()
        client.close()
