import * as Yup from "yup"
import { SIMPLE_EMAIL_REGEX, PIN_REGEX } from "./patterns"

/**
 * Yup validation schema for Principal General Login (Email + Password)
 */
export const generalValidationSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
})

export const getGeneralLoginValidationSchema = () => generalValidationSchema

/**
 * Yup validation schema for Principal Quick Login (Email + PIN)
 */
export const quickValidationSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email is required"),
  pin: Yup.string()
    .matches(PIN_REGEX, "PIN must be 4 to 10 digits")
    .required("PIN is required"),
})

export const getQuickLoginValidationSchema = () => quickValidationSchema

/**
 * Yup validation schema for Principal Email Setup Modal
 */
export const principalEmailSetupValidationSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(SIMPLE_EMAIL_REGEX, "Invalid email format")
    .required("Email address is required"),
  app_password: Yup.string().trim().required("App Password is required"),
})

export const getPrincipalEmailSetupValidationSchema = () => principalEmailSetupValidationSchema
