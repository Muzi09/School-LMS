import * as Yup from "yup"
import { SIMPLE_EMAIL_REGEX, ADMIN_PHONE_REGEX } from "./patterns"

/**
 * Yup validation schema for Admin Login form
 */
export const adminLoginValidationSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
})

export const getAdminLoginValidationSchema = () => adminLoginValidationSchema

/**
 * Yup validation schema for Principal Creation / Management
 */
export const principalValidationSchema = Yup.object().shape({
  first_name: Yup.string()
    .trim()
    .max(50, "Max 50 characters")
    .required("First name is required"),
  last_name: Yup.string()
    .trim()
    .max(50, "Max 50 characters")
    .required("Last name is required"),
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email is required"),
  login_mobile: Yup.string()
    .trim()
    .matches(ADMIN_PHONE_REGEX, "Mobile must be between 5 and 20 digits")
    .required("Mobile number is required"),
})

export const getPrincipalValidationSchema = () => principalValidationSchema

/**
 * Yup validation schema for Platform User Creation / Management (Admin & Sales)
 */
export const userValidationSchema = Yup.object().shape({
  first_name: Yup.string()
    .trim()
    .max(50, "Max 50 characters")
    .required("First name is required"),
  last_name: Yup.string()
    .trim()
    .max(50, "Max 50 characters")
    .required("Last name is required"),
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email is required"),
  login_mobile: Yup.string()
    .trim()
    .matches(ADMIN_PHONE_REGEX, "Mobile must be between 5 and 20 digits")
    .required("Mobile number is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
})

export const getUserValidationSchema = () => userValidationSchema

/**
 * Yup validation schema for SMTP Configuration Modal
 */
export const smtpConfigValidationSchema = Yup.object().shape({
  smtp_host: Yup.string().trim().required("SMTP Host is required"),
  smtp_port: Yup.number()
    .typeError("Port must be a valid number")
    .integer("Port must be an integer")
    .min(1, "Minimum port is 1")
    .max(999, "Maximum port is 3 digits (999)")
    .required("Port is required"),
  from_email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("From Email Address is required"),
  smtp_password: Yup.string().trim().required("App Password is required"),
  from_name: Yup.string().trim().required("From Sender Name is required"),
})

export const getSmtpConfigValidationSchema = () => smtpConfigValidationSchema
