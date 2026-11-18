import os
from uuid import uuid4

import pytest
from sqlalchemy.engine import make_url

TEST_DATABASE_URL = os.environ.get("LMS_TEST_DATABASE_URL")
if TEST_DATABASE_URL:
    url = make_url(TEST_DATABASE_URL)
    if url.get_backend_name() != "postgresql" or not (url.database or "").endswith("_test"):
        pytest.exit("LMS_TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test.")

os.environ["DATABASE_URL"] = TEST_DATABASE_URL or "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET"] = "verification-only-key-for-the-school-lms-test-suite"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["CHAT_REDIS_URL"] = ""
os.environ["SMTP_ALLOWED_HOSTS"] = "smtp.gmail.com,smtp.office365.com,smtp.mail.yahoo.com"


@pytest.fixture(scope="session")
def migrated_db():
    if not TEST_DATABASE_URL:
        pytest.skip("Set LMS_TEST_DATABASE_URL to run PostgreSQL integration tests.")
    from alembic import command
    from alembic.config import Config
    from app.core.database import engine

    config = Config("alembic.ini")
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(migrated_db):
    from sqlalchemy.orm import Session

    with migrated_db.connect() as connection:
        transaction = connection.begin()
        try:
            with Session(bind=connection, join_transaction_mode="create_savepoint", autoflush=False) as session:
                yield session
        finally:
            transaction.rollback()


@pytest.fixture
def school(db):
    from app.models import School, SchoolClass, Section
    from app.services.timetable_service import TimetableService

    school = School(name="Synthetic school", code=f"TEST-{uuid4().hex[:8]}", setup_completed=True)
    db.add(school)
    db.flush()
    school_class = SchoolClass(name="Grade 6", school_id=school.id)
    db.add(school_class)
    db.flush()
    db.add(Section(name="A", school_id=school.id, class_id=school_class.id))
    db.flush()

    TimetableService(db).get_active_timetable(school.id)
    return school


@pytest.fixture
def school_actor(db, school):
    from app.models import PrincipalProfile, User, UserRole

    uid = uuid4()
    actor = User(
        id=uid, first_name="School", last_name="Principal", login_mobile=str(uid.int)[-15:],
        role=UserRole.PRINCIPAL, is_active=True,
    )
    db.add(actor)
    db.flush()
    db.add(PrincipalProfile(user_id=actor.id, school_id=school.id, school_setup_completed=True))
    db.flush()
    return actor
