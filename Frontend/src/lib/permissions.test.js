import { expect, test } from "vitest"
import { hasPermission, Permission, UserRole } from "./permissions.js"

test("principals can manage student records and staff can view the roster", () => {
  expect(hasPermission(UserRole.PRINCIPAL, Permission.MANAGE_STUDENT)).toBe(true)
  expect(hasPermission(UserRole.STAFF, Permission.VIEW_STUDENT)).toBe(true)
  expect(hasPermission(UserRole.STAFF, Permission.MANAGE_STUDENT)).toBe(false)
})
