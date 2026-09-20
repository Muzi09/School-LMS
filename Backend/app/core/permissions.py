from enum import Enum
from app.models.enums import UserRole


class Permission(str, Enum):
    # Staff Management
    MANAGE_STAFF = "MANAGE_STAFF"
    CREATE_STAFF = "CREATE_STAFF"
    VIEW_STAFF = "VIEW_STAFF"
    UPDATE_STAFF = "UPDATE_STAFF"
    DELETE_STAFF = "DELETE_STAFF"
    RESEND_STAFF_SETUP = "RESEND_STAFF_SETUP"

    # Email Setup
    MANAGE_EMAIL_SETUP = "MANAGE_EMAIL_SETUP"

    # Student Management
    MANAGE_STUDENTS = "MANAGE_STUDENTS"
    VIEW_STUDENTS = "VIEW_STUDENTS"

    # Staff Application
    STAFF_DASHBOARD_ACCESS = "STAFF_DASHBOARD_ACCESS"


ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.ADMIN: {
        Permission.MANAGE_STAFF,
        Permission.CREATE_STAFF,
        Permission.VIEW_STAFF,
        Permission.UPDATE_STAFF,
        Permission.DELETE_STAFF,
        Permission.RESEND_STAFF_SETUP,
        Permission.MANAGE_EMAIL_SETUP,
        Permission.MANAGE_STUDENTS,
        Permission.VIEW_STUDENTS,
        Permission.STAFF_DASHBOARD_ACCESS,
    },
    UserRole.PRINCIPAL: {
        Permission.MANAGE_STAFF,
        Permission.CREATE_STAFF,
        Permission.VIEW_STAFF,
        Permission.UPDATE_STAFF,
        Permission.DELETE_STAFF,
        Permission.RESEND_STAFF_SETUP,
        Permission.MANAGE_EMAIL_SETUP,
        Permission.MANAGE_STUDENTS,
        Permission.VIEW_STUDENTS,
        Permission.STAFF_DASHBOARD_ACCESS,
    },
    UserRole.STAFF: {
        Permission.STAFF_DASHBOARD_ACCESS,
        Permission.VIEW_STUDENTS,
        # NOTE: Staff has ZERO Staff Management and ZERO Email Setup permissions!
    },
    UserRole.STUDENT: set(),
    UserRole.SALES_PERSON: set(),
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    """Check if a given role possesses the requested permission."""
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms


def get_role_permissions(role: UserRole) -> list[str]:
    """Retrieve string list of permissions granted to a role."""
    perms = ROLE_PERMISSIONS.get(role, set())
    return sorted([p.value for p in perms])
