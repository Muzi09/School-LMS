from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.enums import UserRole
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.principal import PrincipalProfile
from app.models.user import User
from app.schemas.admin import PrincipalListItem
from app.schemas.common import PaginatedResponse


def get_principal_page(db: Session, page: int, page_size: int) -> PaginatedResponse[PrincipalListItem]:
    query = db.query(User).filter(User.role == UserRole.PRINCIPAL, User.deleted_at.is_(None))
    total = query.count()
    principals = query.options(joinedload(User.principal_profile).joinedload(PrincipalProfile.school)).order_by(
        User.created_at.desc(), User.id.desc(),
    ).offset((page - 1) * page_size).limit(page_size).all()
    pending = [principal.id for principal in principals if not principal.school_setup_completed]
    tokens_by_user = {}
    if pending:
        latest = db.query(PrincipalOnboardingToken).filter(
            PrincipalOnboardingToken.user_id.in_(pending),
        ).distinct(PrincipalOnboardingToken.user_id).order_by(
            PrincipalOnboardingToken.user_id,
            PrincipalOnboardingToken.created_at.desc(),
            PrincipalOnboardingToken.id.desc(),
        ).all()
        tokens_by_user = {token.user_id: token for token in latest}

    now_utc = datetime.now(timezone.utc)
    result: list[PrincipalListItem] = []
    for p in principals:
        school_name = None
        school_code = None
        school = p.principal_profile.school if p.principal_profile else None
        if school and school.deleted_at is None:
            school_name = school.name
            school_code = school.code

        onboarding_link_expired = False
        onboarding_token_expires_at = None
        can_regenerate_onboarding = False

        if not p.school_setup_completed:
            latest_token = tokens_by_user.get(p.id)
            if not latest_token:
                onboarding_link_expired = True
                can_regenerate_onboarding = True
            else:
                onboarding_token_expires_at = latest_token.expires_at
                is_expired = latest_token.expires_at < now_utc or latest_token.used_at is not None
                onboarding_link_expired = is_expired
                can_regenerate_onboarding = is_expired

        result.append(
            PrincipalListItem(
                id=p.id,
                first_name=p.first_name,
                last_name=p.last_name,
                email=p.email,
                login_mobile=p.login_mobile,
                role=p.role,
                is_active=p.is_active,
                school_setup_completed=p.school_setup_completed,
                school_id=p.school_id,
                school_name=school_name,
                school_code=school_code,
                created_at=p.created_at,
                onboarding_link_expired=onboarding_link_expired,
                onboarding_token_expires_at=onboarding_token_expires_at,
                can_regenerate_onboarding=can_regenerate_onboarding,
            )
        )

    return PaginatedResponse.create(items=result, total=total, page=page, page_size=page_size)
