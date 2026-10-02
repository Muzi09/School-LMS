import * as Yup from "yup"
import { EMAIL_REGEX, PHONE_REGEX } from "./patterns"

/**
 * Creates Yup validation schema for Staff form (Create / Edit mode)
 * In Staff form, everything is required.
 */
export const getStaffValidationSchema = (isEdit = false) => {
  return Yup.object().shape({
    first_name: Yup.string()
      .trim()
      .required("First name is required")
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name cannot exceed 50 characters"),

    last_name: Yup.string()
      .trim()
      .required("Last name is required")
      .min(1, "Last name must be at least 1 character")
      .max(50, "Last name cannot exceed 50 characters"),

    login_mobile: Yup.string()
      .trim()
      .required("Login mobile number is required")
      .matches(PHONE_REGEX, "Must be a valid 10 to 15 digit mobile number"),

    email: Yup.string()
      .trim()
      .required("Email address is required")
      .matches(EMAIL_REGEX, "Please enter a valid email address")
      .max(100, "Email cannot exceed 100 characters"),

    roll_no: Yup.string()
      .trim()
      .max(50, "Staff ID cannot exceed 50 characters"),

    gender: Yup.number()
      .required("Gender is required")
      .oneOf([1, 2, 3], "Please select a valid gender"),

    date_of_birth: Yup.string()
      .required("Date of birth is required"),
  })
}

export default getStaffValidationSchema
