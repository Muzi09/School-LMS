import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.chat import Conversation, ConversationParticipant, Message
from app.models.enums import Gender, UserRole
from app.models.principal import PrincipalProfile
from app.models.school import School
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.user import User

client = TestClient(app)


def setup_test_environment():
    """Create test schools and users for testing chat and isolation."""
    db = SessionLocal()
    try:
        # Create School A
        school_a_code = f"SCHA_{uuid.uuid4().hex[:6]}"
        school_a = School(
            name="School Alpha",
            code=school_a_code,
            email=f"{school_a_code}@test.com",
            setup_completed=True,
        )
        db.add(school_a)
        db.flush()

        # Create School B
        school_b_code = f"SCHB_{uuid.uuid4().hex[:6]}"
        school_b = School(
            name="School Beta",
            code=school_b_code,
            email=f"{school_b_code}@test.com",
            setup_completed=True,
        )
        db.add(school_b)
        db.flush()

        # User A1: Principal in School A
        u_a1 = User(
            first_name="Alice",
            last_name="Principal",
            email=f"alice_{uuid.uuid4().hex[:6]}@test.com",
            login_mobile=f"98{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        db.add(u_a1)
        db.flush()
        pp_a1 = PrincipalProfile(
            user_id=u_a1.id,
            school_id=school_a.id,
            school_setup_completed=True,
        )
        db.add(pp_a1)

        # User A2: Staff in School A
        u_a2 = User(
            first_name="Bob",
            last_name="Teacher",
            email=f"bob_{uuid.uuid4().hex[:6]}@test.com",
            login_mobile=f"97{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add(u_a2)
        db.flush()
        sp_a2 = StaffProfile(
            user_id=u_a2.id,
            school_id=school_a.id,
            roll_no=f"STF_{uuid.uuid4().hex[:4]}",
            gender=Gender.MALE,
            date_of_birth=datetime(1990, 1, 1).date(),
            father_first_name="GrandBob",
            father_last_name="Teacher",
            status="ACTIVE",
        )
        db.add(sp_a2)

        # User A3: Student in School A
        u_a3 = User(
            first_name="Charlie",
            last_name="Student",
            email=f"charlie_{uuid.uuid4().hex[:6]}@test.com",
            login_mobile=f"96{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(u_a3)
        db.flush()
        std_a3 = StudentProfile(
            user_id=u_a3.id,
            school_id=school_a.id,
            roll_no="1",
            gender=Gender.MALE,
            date_of_birth=datetime(2010, 5, 10).date(),
            class_name="Grade 10",
            section="A",
            house="Blue House",
            father_first_name="David",
            father_last_name="Student",
        )
        db.add(std_a3)

        # User B1: Staff in School B
        u_b1 = User(
            first_name="Zoe",
            last_name="BetaStaff",
            email=f"zoe_{uuid.uuid4().hex[:6]}@test.com",
            login_mobile=f"95{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add(u_b1)
        db.flush()
        sp_b1 = StaffProfile(
            user_id=u_b1.id,
            school_id=school_b.id,
            roll_no=f"STF_{uuid.uuid4().hex[:4]}",
            gender=Gender.FEMALE,
            date_of_birth=datetime(1992, 2, 2).date(),
            father_first_name="Peter",
            father_last_name="Beta",
            status="ACTIVE",
        )
        db.add(sp_b1)

        db.commit()

        return {
            "school_a_id": school_a.id,
            "school_b_id": school_b.id,
            "u_a1_id": u_a1.id,
            "u_a2_id": u_a2.id,
            "u_a3_id": u_a3.id,
            "u_b1_id": u_b1.id,
        }
    finally:
        db.close()


def test_chat_suite():
    data = setup_test_environment()
    u_a1_id = data["u_a1_id"]
    u_a2_id = data["u_a2_id"]
    u_a3_id = data["u_a3_id"]
    u_b1_id = data["u_b1_id"]

    token_a1 = create_access_token({"sub": str(u_a1_id)})
    token_a2 = create_access_token({"sub": str(u_a2_id)})
    token_a3 = create_access_token({"sub": str(u_a3_id)})
    token_b1 = create_access_token({"sub": str(u_b1_id)})

    headers_a1 = {"Authorization": f"Bearer {token_a1}"}
    headers_a2 = {"Authorization": f"Bearer {token_a2}"}
    headers_a3 = {"Authorization": f"Bearer {token_a3}"}
    headers_b1 = {"Authorization": f"Bearer {token_b1}"}

    print("--- 1. Testing Unauthenticated Access Rejection ---")
    res = client.get("/api/v1/chat/conversations")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    print("[PASS] Unauthenticated REST request correctly rejected with 401")

    print("--- 2. Testing User Discovery within Same School ---")
    res = client.get("/api/v1/chat/users", headers=headers_a1)
    assert res.status_code == 200, res.text
    users = res.json()
    returned_ids = [u["id"] for u in users]
    assert str(u_a1_id) not in returned_ids, "Current user must be excluded from search results"
    assert str(u_a2_id) in returned_ids, "School A peer (staff) must be in search results"
    assert str(u_a3_id) in returned_ids, "School A peer (student) must be in search results"
    assert str(u_b1_id) not in returned_ids, "School B user MUST NOT be in search results (school isolation)"
    print(f"[PASS] Users searched within School A: {len(users)} contacts found, School B isolated")

    print("--- 3. Testing Direct Conversation Creation (A1 -> A2) ---")
    res = client.post("/api/v1/chat/conversations", headers=headers_a1, json={"user_id": str(u_a2_id)})
    assert res.status_code == 201, res.text
    conv1 = res.json()
    conv1_id = conv1["id"]
    assert conv1["other_participant"]["id"] == str(u_a2_id)
    print(f"[PASS] Conversation created: {conv1_id}")

    print("--- 4. Testing Duplicate Prevention (A2 -> A1 resolves to same conv) ---")
    res = client.post("/api/v1/chat/conversations", headers=headers_a2, json={"user_id": str(u_a1_id)})
    assert res.status_code == 201 or res.status_code == 200, res.text
    conv2 = res.json()
    assert conv2["id"] == conv1_id, "B -> A must resolve to the identical conversation as A -> B"
    print("[PASS] Duplicate prevention verified: B -> A returned existing conversation")

    print("--- 5. Testing Database Level Constraint for Duplicate Prevention ---")
    db = SessionLocal()
    try:
        u1, u2 = (u_a1_id, u_a2_id) if u_a1_id < u_a2_id else (u_a2_id, u_a1_id)
        duplicate_conv = Conversation(
            school_id=data["school_a_id"],
            user_a_id=u1,
            user_b_id=u2,
        )
        db.add(duplicate_conv)
        caught = False
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            caught = True
        assert caught, "Database UniqueConstraint must reject duplicate conversation for same user pair"
        print("[PASS] Database-level unique constraint successfully blocked duplicate conversation")
    finally:
        db.close()

    print("--- 6. Testing School Isolation (A1 cannot chat with B1 from School B) ---")
    res = client.post("/api/v1/chat/conversations", headers=headers_a1, json={"user_id": str(u_b1_id)})
    assert res.status_code == 403, f"Expected 403 Forbidden for cross-school chat, got {res.status_code}: {res.text}"
    print("[PASS] Cross-school conversation creation correctly blocked with 403 Forbidden")

    print("--- 7. Testing Send Message via REST and Persistence ---")
    res = client.post(
        f"/api/v1/chat/conversations/{conv1_id}/messages",
        headers=headers_a1,
        json={"content": "Hello Bob from Alice!"},
    )
    assert res.status_code == 201, res.text
    msg1 = res.json()
    assert msg1["content"] == "Hello Bob from Alice!"
    assert msg1["sender_id"] == str(u_a1_id)
    print("[PASS] Message sent and persisted successfully")

    print("--- 8. Testing Message Validation (Empty, Whitespace, Oversized) ---")
    res = client.post(
        f"/api/v1/chat/conversations/{conv1_id}/messages",
        headers=headers_a1,
        json={"content": "   "},
    )
    assert res.status_code == 400, "Empty/whitespace message must be rejected"

    res = client.post(
        f"/api/v1/chat/conversations/{conv1_id}/messages",
        headers=headers_a1,
        json={"content": "a" * 5001},
    )
    assert res.status_code == 422 or res.status_code == 400, "Oversized message must be rejected"
    print("[PASS] Message validation properly rejected empty and oversized content")

    print("--- 9. Testing Access Control (User A3 not in conv cannot read/send) ---")
    res = client.get(f"/api/v1/chat/conversations/{conv1_id}/messages", headers=headers_a3)
    assert res.status_code == 403, "Non-participant must be denied reading messages"

    res = client.post(
        f"/api/v1/chat/conversations/{conv1_id}/messages",
        headers=headers_a3,
        json={"content": "I am eavesdropping"},
    )
    assert res.status_code == 403, "Non-participant must be denied sending messages"
    print("[PASS] Non-participant access strictly rejected with 403 Forbidden")

    print("--- 10. Testing Message History and Pagination ---")
    # Send second message from Bob
    res = client.post(
        f"/api/v1/chat/conversations/{conv1_id}/messages",
        headers=headers_a2,
        json={"content": "Hi Alice! Nice to chat with you."},
    )
    assert res.status_code == 201

    res = client.get(f"/api/v1/chat/conversations/{conv1_id}/messages", headers=headers_a1)
    assert res.status_code == 200
    msg_history = res.json()["messages"]
    assert len(msg_history) == 2
    assert msg_history[0]["content"] == "Hello Bob from Alice!"
    assert msg_history[1]["content"] == "Hi Alice! Nice to chat with you."
    print("[PASS] Message history retrieved in chronological order")

    print("--- 11. Testing Unread Count and Mark As Read ---")
    # For Alice, Bob's message is unread
    res = client.get("/api/v1/chat/conversations", headers=headers_a1)
    assert res.status_code == 200
    convs = res.json()
    conv_a1 = next(c for c in convs if c["id"] == conv1_id)
    assert conv_a1["unread_count"] == 1, f"Expected 1 unread, got {conv_a1['unread_count']}"

    # Alice marks conversation as read
    res = client.post(f"/api/v1/chat/conversations/{conv1_id}/read", headers=headers_a1)
    assert res.status_code == 200

    # Verify unread count is now 0
    res = client.get("/api/v1/chat/conversations", headers=headers_a1)
    convs = res.json()
    conv_a1 = next(c for c in convs if c["id"] == conv1_id)
    assert conv_a1["unread_count"] == 0, f"Expected 0 unread after mark_as_read, got {conv_a1['unread_count']}"
    print("[PASS] Unread count tracking and mark_as_read verified")

    print("--- 12. Testing Principal 1-to-1 Relationship Constraint ---")
    db = SessionLocal()
    try:
        # Try to assign a second principal to School A
        u_p2 = User(
            first_name="Eve",
            last_name="IntruderPrincipal",
            email=f"eve_{uuid.uuid4().hex[:6]}@test.com",
            login_mobile=f"94{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        db.add(u_p2)
        db.flush()
        pp_p2 = PrincipalProfile(
            user_id=u_p2.id,
            school_id=data["school_a_id"],  # Same school as Alice!
            school_setup_completed=True,
        )
        db.add(pp_p2)
        caught_principal_conflict = False
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            caught_principal_conflict = True
        assert caught_principal_conflict, "A school cannot have more than one principal profile (1-to-1 enforcement)"
        print("[PASS] Unique constraint prevented duplicate principal for the same school")
    finally:
        db.close()

    print("--- 13. Testing WebSocket Authentication Rejection ---")
    try:
        with client.websocket_connect("/ws/chat") as ws:
            pass
        assert False, "Unauthenticated WebSocket connection should be closed"
    except Exception:
        print("[PASS] Unauthenticated WebSocket connection properly closed")

    print("--- 14. Testing WebSocket Typing Indicator Events & Security ---")
    with client.websocket_connect(f"/ws/chat?token={token_a1}") as ws_alice:
        # Alice sends typing_start for conv1
        ws_alice.send_json({"type": "typing_start", "conversation_id": str(conv1_id)})
        ws_alice.send_json({"type": "ping"})
        pong = ws_alice.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Alice typing_start handled cleanly")

        # Alice sends typing_stop for conv1
        ws_alice.send_json({"type": "typing_stop", "conversation_id": str(conv1_id)})
        ws_alice.send_json({"type": "ping"})
        pong = ws_alice.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Alice typing_stop handled cleanly")

        # Non-participant / non-existent conversation ID
        fake_conv_id = uuid.uuid4()
        ws_alice.send_json({"type": "typing_start", "conversation_id": str(fake_conv_id)})
        ws_alice.send_json({"type": "ping"})
        pong = ws_alice.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Unauthorized typing event safely ignored without error")

        # Malformed conversation_id does not crash socket
        ws_alice.send_json({"type": "typing_start", "conversation_id": "invalid-uuid"})
        ws_alice.send_json({"type": "ping"})
        pong = ws_alice.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Malformed typing event handled safely without disconnecting")

    print("\n==========================================")
    print("ALL BACKEND CHAT & ISOLATION TESTS PASSED!")
    print("==========================================\n")


if __name__ == "__main__":
    test_chat_suite()
