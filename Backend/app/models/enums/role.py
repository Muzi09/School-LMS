from enum import IntEnum


class UserRole(IntEnum):
    SUPER_ADMIN = 0
    PRINCIPAL = 1
    STAFF = 2
    STUDENT = 3
    SALES_PERSON = 4
