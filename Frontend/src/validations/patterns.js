/**
 * Common regex validation patterns used across the application
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_REGEX = /^[0-9]{10,15}$/
export const ADMIN_PHONE_REGEX = /^\d{5,20}$/
export const PIN_REGEX = /^\d{4,10}$/
export const PINCODE_REGEX = /^\d{6}$/
