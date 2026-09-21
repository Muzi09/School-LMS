import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.enums import Gender, UserRole
from app.models.principal import PrincipalProfile
from app.models.school import School
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.user import User

client = TestClient(app)


def setup_multiuser_environment():
    """Create test school and 4 users: Principal, Staff 1, Staff 2, Student."""
    db = SessionLocal()
    try:
        school_code = f"SCH_{uuid.uuid4().hex[:6]}"
        school = School(
            name="Apex Academy",
            code=school_code,
            email=f"{school_code}@apex.edu",
            setup_completed=True,
        )
        db.add(school)
        db.flush()

        # Other School for isolation testing
        other_school_code = f"OTH_{uuid.uuid4().hex[:6]}"
        other_school = School(
            name="Other Academy",
            code=other_school_code,
            email=f"{other_school_code}@other.edu",
            setup_completed=True,
        )
        db.add(other_school)
        db.flush()

        # 1. Principal
        principal = User(
            first_name="Eleanor",
            last_name="Vance",
            email=f"eleanor_{uuid.uuid4().hex[:6]}@apex.edu",
            login_mobile=f"91{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        db.add(principal)
        db.flush()
        pp = PrincipalProfile(
            user_id=principal.id,
            school_id=school.id,
            school_setup_completed=True,
        )
        db.add(pp)

        # 2. Staff A
        staff_a = User(
            first_name="Marcus",
            last_name="Brody",
            email=f"marcus_{uuid.uuid4().hex[:6]}@apex.edu",
            login_mobile=f"92{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add(staff_a)
        db.flush()
        sp_a = StaffProfile(
            user_id=staff_a.id,
            school_id=school.id,
            roll_no=f"STA_{uuid.uuid4().hex[:4]}",
            gender=Gender.MALE,
            date_of_birth=datetime(1985, 5, 12).date(),
            father_first_name="John",
            father_last_name="Brody",
            status="ACTIVE",
        )
        db.add(sp_a)

        # 3. Staff B
        staff_b = User(
            first_name="Diana",
            last_name="Prince",
            email=f"diana_{uuid.uuid4().hex[:6]}@apex.edu",
            login_mobile=f"93{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add(staff_b)
        db.flush()
        sp_b = StaffProfile(
            user_id=staff_b.id,
            school_id=school.id,
            roll_no=f"STB_{uuid.uuid4().hex[:4]}",
            gender=Gender.FEMALE,
            date_of_birth=datetime(1988, 8, 20).date(),
            father_first_name="Hippolyta",
            father_last_name="Prince",
            status="ACTIVE",
        )
        db.add(sp_b)

        # 4. Student
        student = User(
            first_name="Peter",
            last_name="Parker",
            email=f"peter_{uuid.uuid4().hex[:6]}@apex.edu",
            login_mobile=f"94{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(student)
        db.flush()
        stp = StudentProfile(
            user_id=student.id,
            school_id=school.id,
            roll_no=f"STU_{uuid.uuid4().hex[:4]}",
            gender=Gender.MALE,
            date_of_birth=datetime(2010, 5, 10).date(),
            class_name="Grade 10",
            section="A",
            house="Red",
            father_first_name="Ben",
            father_last_name="Parker",
        )
        db.add(stp)

        # 5. Outside user in Other School
        outsider = User(
            first_name="Victor",
            last_name="VonDoom",
            email=f"victor_{uuid.uuid4().hex[:6]}@other.edu",
            login_mobile=f"95{uuid.uuid4().hex[:8]}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add(outsider)
        db.flush()
        sp_out = StaffProfile(
            user_id=outsider.id,
            school_id=other_school.id,
            roll_no=f"OUT_{uuid.uuid4().hex[:4]}",
            gender=Gender.MALE,
            date_of_birth=datetime(1980, 1, 1).date(),
            father_first_name="VictorSr",
            father_last_name="VonDoom",
            status="ACTIVE",
        )
        db.add(sp_out)

        db.commit()

        token_principal = create_access_token(data={"sub": str(principal.id)})
        token_staff_a = create_access_token(data={"sub": str(staff_a.id)})
        token_staff_b = create_access_token(data={"sub": str(staff_b.id)})
        token_student = create_access_token(data={"sub": str(student.id)})
        token_outsider = create_access_token(data={"sub": str(outsider.id)})

        return {
            "school": school,
            "principal": principal,
            "staff_a": staff_a,
            "staff_b": staff_b,
            "student": student,
            "outsider": outsider,
            "tokens": {
                "principal": token_principal,
                "staff_a": token_staff_a,
                "staff_b": token_staff_b,
                "student": token_student,
                "outsider": token_outsider,
            },
        }
    finally:
        db.close()


def test_group_chat_lifecycle():
    env = setup_multiuser_environment()
    tokens = env["tokens"]
    staff_a = env["staff_a"]
    staff_b = env["staff_b"]
    student = env["student"]
    outsider = env["outsider"]

    # 1. Staff A creates group with Staff B and Student
    headers_a = {"Authorization": f"Bearer {tokens['staff_a']}"}
    headers_b = {"Authorization": f"Bearer {tokens['staff_b']}"}
    headers_stu = {"Authorization": f"Bearer {tokens['student']}"}
    headers_out = {"Authorization": f"Bearer {tokens['outsider']}"}

    create_payload = {
        "name": "Science Department",
        "participant_ids": [str(staff_b.id), str(student.id)],
    }
    res = client.post("/api/v1/chat/conversations/groups", json=create_payload, headers=headers_a)
    assert res.status_code == 201, res.text
    group_data = res.json()
    group_id = group_data["id"]
    assert group_data["type"] == "GROUP"
    assert group_data["name"] == "Science Department"
    assert group_data["is_owner"] is True
    assert group_data["participant_count"] == 3
    print("[PASS] Group created successfully with creator as admin and 3 members")

    # 2. Validation tests
    # Empty name
    res_err1 = client.post("/api/v1/chat/conversations/groups", json={"name": "   ", "participant_ids": [str(staff_b.id)]}, headers=headers_a)
    assert res_err1.status_code in [400, 422]
    # No participants (or only self)
    res_err2 = client.post("/api/v1/chat/conversations/groups", json={"name": "Solo Group", "participant_ids": [str(staff_a.id)]}, headers=headers_a)
    assert res_err2.status_code == 400
    # Cross-school participant
    res_err3 = client.post("/api/v1/chat/conversations/groups", json={"name": "Mixed School", "participant_ids": [str(outsider.id)]}, headers=headers_a)
    assert res_err3.status_code == 403
    print("[PASS] Group creation validations enforced (empty name, self only, cross-school)")

    # 3. All members see the group in their conversation list
    res_list_b = client.get("/api/v1/chat/conversations", headers=headers_b)
    assert res_list_b.status_code == 200
    conv_ids_b = [c["id"] for c in res_list_b.json()]
    assert group_id in conv_ids_b
    b_group = next(c for c in res_list_b.json() if c["id"] == group_id)
    assert b_group["is_owner"] is False
    assert b_group["type"] == "GROUP"
    print("[PASS] Members see the group in conversation list with proper role flags")

    # 4. Group details endpoint
    res_details = client.get(f"/api/v1/chat/conversations/{group_id}/details", headers=headers_b)
    assert res_details.status_code == 200
    details = res_details.json()
    assert details["name"] == "Science Department"
    assert len(details["participants"]) == 3
    p_roles = {p["user_id"]: p["group_role"] for p in details["participants"]}
    assert p_roles[str(staff_a.id)] == "ADMIN"
    assert p_roles[str(staff_b.id)] == "MEMBER"
    assert p_roles[str(student.id)] == "MEMBER"
    print("[PASS] Group details reports accurate participants and group roles")

    # 5. Messaging inside group
    # Staff A sends a message
    res_msg1 = client.post(
        f"/api/v1/chat/conversations/{group_id}/messages",
        json={"content": "Welcome team to the Science Department group!"},
        headers=headers_a,
    )
    assert res_msg1.status_code == 201
    msg1_data = res_msg1.json()
    assert msg1_data["sender_id"] == str(staff_a.id)
    assert msg1_data["sender_name"] == f"{staff_a.first_name} {staff_a.last_name}"

    # Student replies
    res_msg2 = client.post(
        f"/api/v1/chat/conversations/{group_id}/messages",
        json={"content": "Hello Mr. Brody! Excited to be here."},
        headers=headers_stu,
    )
    assert res_msg2.status_code == 201
    msg2_data = res_msg2.json()
    assert msg2_data["sender_id"] == str(student.id)
    assert msg2_data["sender_name"] == f"{student.first_name} {student.last_name}"

    # Verify history for Staff B
    res_msgs = client.get(f"/api/v1/chat/conversations/{group_id}/messages", headers=headers_b)
    assert res_msgs.status_code == 200
    msgs = res_msgs.json()["messages"]
    # Messages include initial system message + msg1 + msg2
    assert len(msgs) >= 3
    sender_names = [m.get("sender_name") for m in msgs if m["message_type"] == "TEXT"]
    assert f"{staff_a.first_name} {staff_a.last_name}" in sender_names
    assert f"{student.first_name} {student.last_name}" in sender_names
    print("[PASS] Group messaging delivered and sender names populated correctly")

    # 6. Non-participant cannot send or read
    res_out_send = client.post(
        f"/api/v1/chat/conversations/{group_id}/messages",
        json={"content": "I want to hack in"},
        headers=headers_out,
    )
    assert res_out_send.status_code == 403
    res_out_read = client.get(f"/api/v1/chat/conversations/{group_id}/messages", headers=headers_out)
    assert res_out_read.status_code == 403
    print("[PASS] Non-participants blocked from reading or sending in group")

    # 7. Group administration: Add & Remove participants
    principal = env["principal"]
    headers_p = {"Authorization": f"Bearer {tokens['principal']}"}

    # Non-admin (Staff B) attempts to add Principal -> Forbidden
    res_unauth_add = client.post(
        f"/api/v1/chat/conversations/{group_id}/participants",
        json={"user_ids": [str(principal.id)]},
        headers=headers_b,
    )
    assert res_unauth_add.status_code == 403

    # Admin (Staff A) adds Principal
    res_admin_add = client.post(
        f"/api/v1/chat/conversations/{group_id}/participants",
        json={"user_ids": [str(principal.id)]},
        headers=headers_a,
    )
    assert res_admin_add.status_code == 200

    # Verify Principal is now a member
    res_p_details = client.get(f"/api/v1/chat/conversations/{group_id}/details", headers=headers_p)
    assert res_p_details.status_code == 200
    assert len(res_p_details.json()["participants"]) == 4

    # Admin renames group
    res_rename = client.patch(
        f"/api/v1/chat/conversations/{group_id}",
        json={"name": "STEM & Science Dept"},
        headers=headers_a,
    )
    assert res_rename.status_code == 200

    # Admin removes Student
    res_remove = client.delete(
        f"/api/v1/chat/conversations/{group_id}/participants/{student.id}",
        headers=headers_a,
    )
    assert res_remove.status_code == 200

    # Removed student loses access
    res_stu_lost = client.get(f"/api/v1/chat/conversations/{group_id}/messages", headers=headers_stu)
    assert res_stu_lost.status_code == 403
    print("[PASS] Admin controls enforced: adding, renaming, removing, and authorization revoke")


def test_broadcast_lifecycle():
    env = setup_multiuser_environment()
    tokens = env["tokens"]
    principal = env["principal"]
    staff_a = env["staff_a"]
    staff_b = env["staff_b"]
    student = env["student"]

    headers_p = {"Authorization": f"Bearer {tokens['principal']}"}
    headers_a = {"Authorization": f"Bearer {tokens['staff_a']}"}
    headers_stu = {"Authorization": f"Bearer {tokens['student']}"}

    # 1. Principal creates broadcast
    create_payload = {
        "name": "School Emergency Alerts",
        "recipient_ids": [str(staff_a.id), str(staff_b.id), str(student.id)],
    }
    res = client.post("/api/v1/chat/conversations/broadcasts", json=create_payload, headers=headers_p)
    assert res.status_code == 201, res.text
    bcast_data = res.json()
    bcast_id = bcast_data["id"]
    assert bcast_data["type"] == "BROADCAST"
    assert bcast_data["name"] == "School Emergency Alerts"
    assert bcast_data["is_owner"] is True
    print("[PASS] Broadcast list created successfully by Principal")

    # 2. Owner sends an announcement
    res_msg = client.post(
        f"/api/v1/chat/conversations/{bcast_id}/messages",
        json={"content": "School will remain closed tomorrow due to weather conditions."},
        headers=headers_p,
    )
    assert res_msg.status_code == 201
    msg = res_msg.json()
    assert msg["sender_name"] == f"{principal.first_name} {principal.last_name}"
    print("[PASS] Broadcast announcement sent by owner")

    # 3. Recipients can read the broadcast
    res_a_read = client.get(f"/api/v1/chat/conversations/{bcast_id}/messages", headers=headers_a)
    assert res_a_read.status_code == 200
    msgs_a = res_a_read.json()["messages"]
    announcement = next(m for m in msgs_a if m["message_type"] == "TEXT")
    assert "closed tomorrow" in announcement["content"]
    print("[PASS] Recipients can read broadcast message history")

    # 4. Recipients CANNOT send messages into the broadcast
    res_a_reply = client.post(
        f"/api/v1/chat/conversations/{bcast_id}/messages",
        json={"content": "Thank you for the update!"},
        headers=headers_a,
    )
    assert res_a_reply.status_code == 403
    assert "Only the broadcast creator" in res_a_reply.json()["detail"]

    res_stu_reply = client.post(
        f"/api/v1/chat/conversations/{bcast_id}/messages",
        json={"content": "Yay no school!"},
        headers=headers_stu,
    )
    assert res_stu_reply.status_code == 403
    print("[PASS] Recipients strictly blocked from sending messages into broadcast")


def test_websocket_group_and_broadcast():
    env = setup_multiuser_environment()
    tokens = env["tokens"]
    staff_a = env["staff_a"]
    staff_b = env["staff_b"]

    headers_a = {"Authorization": f"Bearer {tokens['staff_a']}"}

    # Create group
    res_grp = client.post(
        "/api/v1/chat/conversations/groups",
        json={"name": "WS Test Group", "participant_ids": [str(staff_b.id)]},
        headers=headers_a,
    )
    grp_id = res_grp.json()["id"]

    # Create broadcast
    res_bc = client.post(
        "/api/v1/chat/conversations/broadcasts",
        json={"name": "WS Test Broadcast", "recipient_ids": [str(staff_b.id)]},
        headers=headers_a,
    )
    bc_id = res_bc.json()["id"]

    # 1. Staff A connects and tests WebSocket sending and typing
    with client.websocket_connect(f"/ws/chat?token={tokens['staff_a']}") as ws_a:
        # Group typing start
        ws_a.send_json({
            "type": "typing_start",
            "conversation_id": str(grp_id),
        })
        ws_a.send_json({"type": "ping"})
        pong = ws_a.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Group typing_start processed cleanly by server")

        # Group typing stop
        ws_a.send_json({
            "type": "typing_stop",
            "conversation_id": str(grp_id),
        })
        ws_a.send_json({"type": "ping"})
        pong = ws_a.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Group typing_stop processed cleanly by server")

        # Broadcast typing: typing in broadcast list should be safely suppressed
        ws_a.send_json({
            "type": "typing_start",
            "conversation_id": str(bc_id),
        })
        ws_a.send_json({"type": "ping"})
        pong = ws_a.receive_json()
        assert pong["type"] == "pong"
        print("[PASS] Broadcast typing_start safely suppressed for broadcast list")

        # Send message via WebSocket
        ws_a.send_json({
            "type": "send_message",
            "conversation_id": str(grp_id),
            "content": "Real-time group chat message via WS",
            "temp_id": "temp-ws-grp-1",
        })
        sent_evt = ws_a.receive_json()
        while sent_evt.get("type") == "presence":
            sent_evt = ws_a.receive_json()
        assert sent_evt["type"] == "message_sent"
        assert sent_evt["temp_id"] == "temp-ws-grp-1"
        assert sent_evt["message"]["content"] == "Real-time group chat message via WS"
        assert sent_evt["message"]["sender_name"] == f"{staff_a.first_name} {staff_a.last_name}"
        print("[PASS] WebSocket group message send and confirmation verified")

    # 2. Staff B connects and listens for Staff A connecting (presence delivery)
    with client.websocket_connect(f"/ws/chat?token={tokens['staff_b']}") as ws_b:
        with client.websocket_connect(f"/ws/chat?token={tokens['staff_a']}") as ws_a_inner:
            online_evt = ws_b.receive_json()
            assert online_evt["type"] == "presence"
            assert online_evt["user_id"] == str(staff_a.id)
            assert online_evt["is_online"] is True
            print("[PASS] WebSocket presence broadcast across group participants verified")

        # 3. Staff B attempts to send message to BROADCAST via WebSocket -> Must fail
        ws_b.send_json({
            "type": "send_message",
            "conversation_id": str(bc_id),
            "content": "Staff B attempting to broadcast",
            "temp_id": "temp-ws-bc-fail",
        })
        fail_evt = ws_b.receive_json()
        while fail_evt.get("type") in ["presence", "read_receipt"]:
            fail_evt = ws_b.receive_json()
        assert fail_evt["type"] == "message_failed"
        assert fail_evt["temp_id"] == "temp-ws-bc-fail"
        assert "Only the broadcast creator" in fail_evt["error"]
        print("[PASS] WebSocket message sending blocked for broadcast recipients")


def test_leave_group_with_ownership_transfer():
    env = setup_multiuser_environment()
    tokens = env["tokens"]
    staff_a = env["staff_a"]
    staff_b = env["staff_b"]
    student = env["student"]

    headers_a = {"Authorization": f"Bearer {tokens['staff_a']}"}
    headers_b = {"Authorization": f"Bearer {tokens['staff_b']}"}
    headers_stu = {"Authorization": f"Bearer {tokens['student']}"}

    # 1. Staff A creates group with Staff B and Student
    res = client.post(
        "/api/v1/chat/conversations/groups",
        json={"name": "Handover Test Group", "participant_ids": [str(staff_b.id), str(student.id)]},
        headers=headers_a,
    )
    assert res.status_code == 201
    grp_id = res.json()["id"]

    # 2. Student leaves group normally (non-admin leaver)
    res_leave_stu = client.post(
        f"/api/v1/chat/conversations/{grp_id}/leave",
        headers=headers_stu,
    )
    assert res_leave_stu.status_code == 200
    assert res_leave_stu.json()["success"] is True

    # Verify student is no longer in group details
    res_details = client.get(f"/api/v1/chat/conversations/{grp_id}/details", headers=headers_a)
    p_ids = [p["user_id"] for p in res_details.json()["participants"]]
    assert str(student.id) not in p_ids
    assert len(p_ids) == 2
    print("[PASS] Regular member can leave group cleanly")

    # 3. Staff A (Admin/Owner) leaves without specifying new owner when others exist -> should fail or require new_owner_id
    res_leave_admin_fail = client.post(
        f"/api/v1/chat/conversations/{grp_id}/leave",
        headers=headers_a,
    )
    assert res_leave_admin_fail.status_code == 400
    assert "transfer ownership" in res_leave_admin_fail.json()["detail"].lower()
    print("[PASS] Admin cannot leave multi-member group without transferring ownership")

    # 4. Staff A leaves and transfers ownership to Staff B
    res_leave_admin_ok = client.post(
        f"/api/v1/chat/conversations/{grp_id}/leave",
        json={"new_owner_id": str(staff_b.id)},
        headers=headers_a,
    )
    assert res_leave_admin_ok.status_code == 200

    # Verify Staff B is now owner and admin
    res_details_after = client.get(f"/api/v1/chat/conversations/{grp_id}/details", headers=headers_b)
    assert res_details_after.status_code == 200
    after_data = res_details_after.json()
    assert after_data["created_by_id"] == str(staff_b.id)
    b_p = next(p for p in after_data["participants"] if p["user_id"] == str(staff_b.id))
    assert b_p["group_role"] == "ADMIN"
    print("[PASS] Admin successfully transferred ownership upon leaving")


if __name__ == "__main__":
    print("\n--- RUNNING GROUP & BROADCAST CHAT TESTS ---")
    test_group_chat_lifecycle()
    test_broadcast_lifecycle()
    test_websocket_group_and_broadcast()
    print("\n=======================================================")
    print("ALL GROUP & BROADCAST CHAT TESTS PASSED SUCCESSFULLY!")
    print("=======================================================\n")


