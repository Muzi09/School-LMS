import * as Yup from "yup"
import { EMAIL_REGEX, PHONE_REGEX } from "./patterns"

/**
 * Creates Yup validation schema for Staff form (Create / Edit mode)
 * In Staff form, everything is required.
 */
export const getStaffValidationSchema = (isEdit = false, hasWings = false) => {
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

    tag: Yup.string()
      .trim()
      .required("Designation is required")
      .max(100, "Designation cannot exceed 100 characters"),

    is_academic: Yup.boolean(),
    is_non_academic: Yup.boolean(),

    assigned_wing_ids: Yup.array().of(Yup.string()),

    working_shifts: Yup.array().of(
      Yup.object().shape({
        start_time: Yup.string().required("Start time is required"),
        end_time: Yup.string().required("End time is required"),
      })
    ),
  }).test(
    "at-least-one-role",
    "At least one classification must be selected (Academic or Non-Academic)",
    function (values) {
      if (!values) return true
      return Boolean(values.is_academic || values.is_non_academic)
    }
  ).test(
    "academic-wing-required",
    "Please select at least one wing for academic staff.",
    function (values) {
      if (!values) return true
      if (values.is_academic && hasWings) {
        if (!values.assigned_wing_ids || values.assigned_wing_ids.length === 0) {
          return this.createError({
            path: "assigned_wing_ids",
            message: "Please select at least one wing for academic staff.",
          })
        }
      }
      return true
    }
  )
}

export default getStaffValidationSchema
