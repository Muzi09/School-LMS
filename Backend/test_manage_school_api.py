import io
import time
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole
from app.models.house import House
from app.models.principal import PrincipalProfile
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.subject import Subject, ClassSubject
from app.models.timetable import TimetableEntry, TimetablePeriod
from app.models.user import User
from app.models.wing import Wing, WingClass

client = TestClient(app)

def create_test_user_and_school(role=UserRole.PRINCIPAL, suffix=""):
    db = SessionLocal()
    ts = int(time.time() * 1000)
    unique_suffix = f"{suffix}_{ts}_{uuid.uuid4().hex[:6]}"

    school = School(
        name=f"Test School {unique_suffix}",
        code=f"SCH_{uuid.uuid4().hex[:12].upper()}",
        email=f"school_{unique_suffix}@test.edu",
        phone="9876543210",
        address="123 Test Road",
        primary_color="#1E40AF",
        is_active=True,
        setup_completed=True,
    )
    db.add(school)
    db.flush()

    user = User(
        first_name="Test",
        last_name="Principal" if role == UserRole.PRINCIPAL else "Staff",
        email=f"user_{unique_suffix}@test.edu",
        login_mobile=f"9{str(ts)[-9:]}",
        password_hash=hash_password("Password123!"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if role == UserRole.PRINCIPAL:
        profile = PrincipalProfile(
            user_id=user.id,
            school_id=school.id,
            school_setup_completed=True,
        )
        db.add(profile)
    elif role == UserRole.STAFF:
        profile = StaffProfile(
            user_id=user.id,
            school_id=school.id,
            roll_no=f"STF_{unique_suffix[:10]}",
            gender=1,
            date_of_birth=datetime(1990, 1, 1).date(),
            status="ACTIVE",
        )
        db.add(profile)

    school.created_by = user.id
    db.commit()
    db.refresh(school)
    db.refresh(user)

    role_val = user.role.value if hasattr(user.role, "value") else int(user.role)
    token = create_access_token(data={"sub": str(user.id), "role": role_val})
    db.close()
    return school, user, token


def test_manage_school_suite():
    print("\n" + "=" * 80)
    print("STARTING COMPREHENSIVE MANAGE SCHOOL WORKSPACE TESTS")
    print("=" * 80)

    # 1. Setup School A and Principal A
    school_a, user_a, token_a = create_test_user_and_school(UserRole.PRINCIPAL, "a")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Setup School B and Principal B for tenant isolation testing
    school_b, user_b, token_b = create_test_user_and_school(UserRole.PRINCIPAL, "b")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Setup Staff user (no MANAGE_SCHOOL permission)
    _, staff_user, staff_token = create_test_user_and_school(UserRole.STAFF, "staff")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    print("[PASS] Step 1: Created test schools and authenticated users.")

    # 2. Authorization Checks
    unauth_res = client.get("/api/v1/school/config")
    assert unauth_res.status_code == 401, f"Expected 401 unauthenticated, got {unauth_res.status_code}"

    staff_res = client.get("/api/v1/school/config", headers=staff_headers)
    assert staff_res.status_code == 403, f"Expected 403 for staff without MANAGE_SCHOOL, got {staff_res.status_code}"

    res_a = client.get("/api/v1/school/config", headers=headers_a)
    assert res_a.status_code == 200, f"Failed to get config: {res_a.text}"
    config_data = res_a.json()
    assert "classes" in config_data
    assert "wings" in config_data
    assert "subjects" in config_data
    assert "houses" in config_data
    assert "customization" in config_data
    assert config_data["customization"]["primary_color"] == "#1E40AF"
    print("[PASS] Step 2: Authorization, permissions, and GET /school/config verified.")

    # 3. Class Management: Create, Duplicate Validation, Rename, Reorder
    c_res = client.post(
        "/api/v1/school/classes",
        headers=headers_a,
        json={"name": "Class 1", "order_index": 1, "initial_sections": ["A", "B"]},
    )
    assert c_res.status_code == 201, f"Failed to create class: {c_res.text}"
    class_1_id = c_res.json()["id"]

    dup_c_res = client.post(
        "/api/v1/school/classes",
        headers=headers_a,
        json={"name": "Class 1", "order_index": 2},
    )
    assert dup_c_res.status_code == 400, "Expected duplicate class to fail with 400"
    assert "already exists" in dup_c_res.json()["detail"]

    c2_res = client.post(
        "/api/v1/school/classes",
        headers=headers_a,
        json={"name": "Class 2", "order_index": 2, "initial_sections": ["A"]},
    )
    assert c2_res.status_code == 201
    class_2_id = c2_res.json()["id"]

    patch_c = client.patch(
        f"/api/v1/school/classes/{class_1_id}",
        headers=headers_a,
        json={"name": "Grade 1 Renamed", "order_index": 0},
    )
    assert patch_c.status_code == 200
    assert patch_c.json()["name"] == "Grade 1 Renamed"

    # Reorder classes
    reorder_res = client.put(
        "/api/v1/school/classes/reorder",
        headers=headers_a,
        json={"classes": [{"class_id": class_1_id, "order_index": 10}, {"class_id": class_2_id, "order_index": 20}]},
    )
    assert reorder_res.status_code == 200
    print("[PASS] Step 3: Class creation, duplicate validation, rename, and batch reorder verified.")

    # 4. Tenant Isolation Check
    cross_patch = client.patch(
        f"/api/v1/school/classes/{class_1_id}",
        headers=headers_b,
        json={"name": "Hacked Class"},
    )
    assert cross_patch.status_code == 404, f"Cross-school update should return 404, got {cross_patch.status_code}"

    cross_del = client.delete(f"/api/v1/school/classes/{class_1_id}", headers=headers_b)
    assert cross_del.status_code == 404, f"Cross-school delete should return 404, got {cross_del.status_code}"
    print("[PASS] Step 4: Strict cross-school tenant isolation verified.")

    # 5. Section Management: Add, Rename, Duplicate Check, Delete
    sec_add = client.post(
        f"/api/v1/school/classes/{class_1_id}/sections",
        headers=headers_a,
        json={"name": "C"},
    )
    assert sec_add.status_code == 201
    sec_c_id = sec_add.json()["id"]

    sec_dup = client.post(
        f"/api/v1/school/classes/{class_1_id}/sections",
        headers=headers_a,
        json={"name": "C"},
    )
    assert sec_dup.status_code == 400
    assert "already exists" in sec_dup.json()["detail"]

    sec_patch = client.patch(
        f"/api/v1/school/sections/{sec_c_id}",
        headers=headers_a,
        json={"name": "Gold"},
    )
    assert sec_patch.status_code == 200
    assert sec_patch.json()["name"] == "Gold"

    sec_del = client.delete(f"/api/v1/school/sections/{sec_c_id}", headers=headers_a)
    assert sec_del.status_code == 200
    print("[PASS] Step 5: Section CRUD, duplicate checking, and deletion verified.")

    # 6. Safety check: Class & Section deletion safety when student is enrolled
    db = SessionLocal()
    student_user = User(
        first_name="Junior",
        last_name="Doe",
        login_mobile=f"9{str(int(time.time()*1000))[-9:]}",
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()

    # Get section of class 2
    sec_cls2 = db.query(Section).filter(Section.class_id == uuid.UUID(class_2_id)).first()
    sec_cls2_id = str(sec_cls2.id)

    student_profile = StudentProfile(
        user_id=student_user.id,
        school_id=school_a.id,
        roll_no="R-101",
        gender=1,
        date_of_birth=datetime(2015, 5, 5).date(),
        class_name="Class 2",
        section=sec_cls2.name,
        house="Red House",
        father_first_name="Senior",
        father_last_name="Doe",
    )
    db.add(student_profile)
    db.commit()
    db.close()

    # Attempting to delete Class 2 should be rejected because a student is enrolled
    unsafe_del_cls = client.delete(f"/api/v1/school/classes/{class_2_id}", headers=headers_a)
    assert unsafe_del_cls.status_code == 400, f"Expected 400 for unsafe class deletion, got {unsafe_del_cls.status_code}"
    assert "currently enrolled" in unsafe_del_cls.json()["detail"]

    # Attempting to delete Section should also be rejected
    unsafe_del_sec = client.delete(f"/api/v1/school/sections/{sec_cls2_id}", headers=headers_a)
    assert unsafe_del_sec.status_code == 400
    assert "student(s) are assigned" in unsafe_del_sec.json()["detail"]
    print("[PASS] Step 6: Safe dependency checks preventing accidental deletion with enrolled students verified.")

    # 7. Wings Management: Create, Assign classes, Update, and Unassignment on Delete
    wing_res = client.post(
        "/api/v1/school/wings",
        headers=headers_a,
        json={"name": "Primary Wing", "order_index": 1, "class_ids": [class_1_id, class_2_id]},
    )
    assert wing_res.status_code == 201
    wing_id = wing_res.json()["id"]

    patch_wing = client.patch(
        f"/api/v1/school/wings/{wing_id}",
        headers=headers_a,
        json={"name": "Junior Wing", "class_ids": [class_1_id]},
    )
    assert patch_wing.status_code == 200

    # Delete wing -> class_1 should become unassigned, NOT deleted
    del_wing = client.delete(f"/api/v1/school/wings/{wing_id}", headers=headers_a)
    assert del_wing.status_code == 200

    cfg_after_wing = client.get("/api/v1/school/config", headers=headers_a).json()
    cls_1_cfg = next(c for c in cfg_after_wing["classes"] if c["id"] == class_1_id)
    assert cls_1_cfg["wing_id"] is None, "Class should be unassigned when wing is deleted"
    print("[PASS] Step 7: Wing management, class remapping, and safe unassignment verified.")

    # 8. Subjects Management: Create, Assign, Update, Reorder, Delete
    sub_res = client.post(
        "/api/v1/school/subjects",
        headers=headers_a,
        json={
            "name": "Mathematics",
            "code": "MATH101",
            "category": "academic",
            "is_academic": True,
            "order_index": 1,
            "assigned_class_ids": [class_1_id],
        },
    )
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["id"]

    sub_patch = client.patch(
        f"/api/v1/school/subjects/{sub_id}",
        headers=headers_a,
        json={"category": "non_academic", "is_academic": False},
    )
    assert sub_patch.status_code == 200

    del_sub = client.delete(f"/api/v1/school/subjects/{sub_id}", headers=headers_a)
    assert del_sub.status_code == 200
    print("[PASS] Step 8: Subject management, assignments, and deletion verified.")

    # 9. Houses Management: Create, Max 4 validation, Duplicate, Update, Delete
    h1 = client.post("/api/v1/school/houses", headers=headers_a, json={"name": "Ruby Red", "color": "#EF4444"})
    assert h1.status_code == 201
    h2 = client.post("/api/v1/school/houses", headers=headers_a, json={"name": "Sapphire Blue", "color": "#3B82F6"})
    assert h2.status_code == 201
    h3 = client.post("/api/v1/school/houses", headers=headers_a, json={"name": "Emerald Green", "color": "#10B981"})
    assert h3.status_code == 201
    h4 = client.post("/api/v1/school/houses", headers=headers_a, json={"name": "Amber Gold", "color": "#F59E0B"})
    assert h4.status_code == 201

    # 5th house must be rejected
    h5 = client.post("/api/v1/school/houses", headers=headers_a, json={"name": "Diamond White", "color": "#FFFFFF"})
    assert h5.status_code == 400
    assert "Maximum 4 houses" in h5.json()["detail"]

    patch_h = client.patch(
        f"/api/v1/school/houses/{h1.json()['id']}",
        headers=headers_a,
        json={"name": "Crimson Ruby", "color": "#DC2626"},
    )
    assert patch_h.status_code == 200

    del_h = client.delete(f"/api/v1/school/houses/{h4.json()['id']}", headers=headers_a)
    assert del_h.status_code == 200
    print("[PASS] Step 9: House management, max 4 limit, and update/delete verified.")

    # 10. School Customization: HEX Color validation & Emblem Upload
    inv_col = client.patch(
        "/api/v1/school/customization",
        headers=headers_a,
        json={"primary_color": "not_a_hex"},
    )
    assert inv_col.status_code == 400
    assert "HEX" in inv_col.json()["detail"]

    valid_col = client.patch(
        "/api/v1/school/customization",
        headers=headers_a,
        json={"primary_color": "#059669"},
    )
    assert valid_col.status_code == 200
    assert valid_col.json()["primary_color"] == "#059669"

    # Emblem upload
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("emblem.png", io.BytesIO(fake_png), "image/png")}
    up_res = client.post("/api/v1/school/customization/emblem", headers=headers_a, files=files)
    assert up_res.status_code == 200
    assert up_res.json()["success"] is True
    assert up_res.json()["emblem_url"].startswith("/uploads/emblems/emblem_")

    # Update emblem on school
    emb_patch = client.patch(
        "/api/v1/school/customization",
        headers=headers_a,
        json={"emblem_url": up_res.json()["emblem_url"]},
    )
    assert emb_patch.status_code == 200
    # Step 11: Class Teacher & Subject Teacher Assignment
    # Create Staff members for School A and School B
    _, staff_a, _ = create_test_user_and_school(UserRole.STAFF, "staff_a")
    # Associate staff_a profile properly to school_a
    db = SessionLocal()
    staff_a_profile = db.query(StaffProfile).filter(StaffProfile.user_id == staff_a.id).first()
    staff_a_profile.school_id = school_a.id
    staff_a_profile.designation = "Senior Teacher"
    staff_a_profile.department = "Science"
    db.commit()

    # List teachers for School A
    teachers_res = client.get("/api/v1/school/teachers", headers=headers_a)
    assert teachers_res.status_code == 200
    teachers_data = teachers_res.json()
    assert any(t["id"] == str(staff_a.id) for t in teachers_data)
    print(f"[PASS] Step 11a: Listed school teachers, found staff_a ({staff_a.id}).")

    # Get a section from class_1
    classes_list = client.get("/api/v1/school/classes", headers=headers_a).json()
    cls_1 = next(c for c in classes_list if c["id"] == class_1_id)
    target_section = cls_1["sections"][0]
    target_section_id = target_section["id"]

    # Assign class teacher to target_section
    assign_ct_res = client.put(
        f"/api/v1/school/sections/{target_section_id}/class-teacher",
        headers=headers_a,
        json={"teacher_id": str(staff_a.id)}
    )
    assert assign_ct_res.status_code == 200
    assert assign_ct_res.json()["class_teacher_id"] == str(staff_a.id)
    assert assign_ct_res.json()["class_teacher"]["id"] == str(staff_a.id)
    assert assign_ct_res.json()["class_teacher"]["designation"] == "Senior Teacher"

    # Verify via get_classes
    classes_check = client.get("/api/v1/school/classes", headers=headers_a)
    sec_found = next(
        s for c in classes_check.json() for s in c["sections"] if s["id"] == target_section_id
    )
    assert sec_found["class_teacher_id"] == str(staff_a.id)
    assert sec_found["class_teacher"]["name"] == f"{staff_a.first_name} {staff_a.last_name}"
    print("[PASS] Step 11b: Assigned and verified class teacher for section.")

    # Create a subject and assign to class_1
    new_sub = client.post(
        "/api/v1/school/subjects",
        headers=headers_a,
        json={
            "name": "Physics",
            "code": "PHY101",
            "category": "academic",
            "is_academic": True,
            "order_index": 1,
            "assigned_class_ids": [class_1_id],
        },
    ).json()
    target_sub_id = new_sub["id"]

    # Assign subject teacher to physics in target_section
    assign_st_res = client.put(
        f"/api/v1/school/sections/{target_section_id}/subjects/{target_sub_id}/teacher",
        headers=headers_a,
        json={"teacher_id": str(staff_a.id)}
    )
    assert assign_st_res.status_code == 200
    assert assign_st_res.json()["teacher_id"] == str(staff_a.id)
    assert assign_st_res.json()["teacher"]["id"] == str(staff_a.id)
    print("[PASS] Step 11c: Assigned and verified section subject teacher.")

    # Unassign subject teacher
    unassign_st_res = client.put(
        f"/api/v1/school/sections/{target_section_id}/subjects/{target_sub_id}/teacher",
        headers=headers_a,
        json={"teacher_id": None}
    )
    assert unassign_st_res.status_code == 200
    assert unassign_st_res.json()["teacher_id"] is None
    assert unassign_st_res.json()["teacher"] is None
    print("[PASS] Step 11d: Unassigned section subject teacher.")

    # Unassign class teacher
    unassign_ct_res = client.put(
        f"/api/v1/school/sections/{target_section_id}/class-teacher",
        headers=headers_a,
        json={"teacher_id": None}
    )
    assert unassign_ct_res.status_code == 200
    assert unassign_ct_res.json()["class_teacher_id"] is None
    assert unassign_ct_res.json()["class_teacher"] is None
    print("[PASS] Step 11e: Unassigned class teacher.")

    # Tenant isolation: Try to assign staff_user (who belongs to staff's school, not school_a)
    # staff_user belongs to another school created in line 97
    cross_tenant_res = client.put(
        f"/api/v1/school/sections/{target_section_id}/class-teacher",
        headers=headers_a,
        json={"teacher_id": str(staff_user.id)}
    )
    assert cross_tenant_res.status_code in (400, 404)
    print("[PASS] Step 11f: Cross-tenant teacher assignment successfully blocked.")

    db.close()
    print("[PASS] Step 11: Class Teacher & Subject Teacher Assignment tests completed.")

    print("\nALL MANAGE SCHOOL BACKEND TESTS PASSED SUCCESSFULLY!\n")


if __name__ == "__main__":
    test_manage_school_suite()

