/**
 * Role-Based Access Control (RBAC) Permissions System
 *
 * Centralized authorization rules matching backend app/core/permissions.py
 */

export const UserRole = {
  SUPER_ADMIN: 0,
  PRINCIPAL: 1,
  STAFF: 2,
  STUDENT: 3,
}

export const Permission = {
  // Staff management
  MANAGE_STAFF: "MANAGE_STAFF",
  VIEW_STAFF: "VIEW_STAFF",
  CREATE_STAFF: "CREATE_STAFF",
  UPDATE_STAFF: "UPDATE_STAFF",
  DELETE_STAFF: "DELETE_STAFF",
  RESEND_STAFF_SETUP: "RESEND_STAFF_SETUP",

  // Email setup
  EMAIL_SETUP: "EMAIL_SETUP",

  // Student management
  MANAGE_STUDENT: "MANAGE_STUDENT",
  VIEW_STUDENT: "VIEW_STUDENT",

  // Dashboard & general
  STAFF_DASHBOARD_ACCESS: "STAFF_DASHBOARD_ACCESS",
  PRINCIPAL_DASHBOARD_ACCESS: "PRINCIPAL_DASHBOARD_ACCESS",
}

export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.PRINCIPAL]: [
    Permission.MANAGE_STAFF,
    Permission.VIEW_STAFF,
    Permission.CREATE_STAFF,
    Permission.UPDATE_STAFF,
    Permission.DELETE_STAFF,
    Permission.RESEND_STAFF_SETUP,
    Permission.EMAIL_SETUP,
    Permission.MANAGE_STUDENT,
    Permission.VIEW_STUDENT,
    Permission.PRINCIPAL_DASHBOARD_ACCESS,
    Permission.STAFF_DASHBOARD_ACCESS,
  ],
  [UserRole.STAFF]: [
    Permission.STAFF_DASHBOARD_ACCESS,
    Permission.VIEW_STUDENT,
    Permission.MANAGE_STUDENT,
  ],
  [UserRole.STUDENT]: [],
}

/**
 * Check whether a given role holds a specific permission.
 *
 * @param {number|string} role - The user's role code
 * @param {string} permission - The permission identifier to check
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (role === undefined || role === null || !permission) return false
  const numericRole = Number(role)
  const allowed = ROLE_PERMISSIONS[numericRole] || []
  return allowed.includes(permission)
}

/**
 * Check whether a given role holds any of the listed permissions.
 *
 * @param {number|string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions = []) {
  return permissions.some((perm) => hasPermission(role, perm))
}

/**
 * Check whether a given role holds all listed permissions.
 *
 * @param {number|string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAllPermissions(role, permissions = []) {
  return permissions.every((perm) => hasPermission(role, perm))
}
