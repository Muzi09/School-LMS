import * as Yup from "yup"
import { EMAIL_REGEX, PHONE_REGEX } from "./patterns"

/**
 * Creates Yup validation schema for Student form (Create / Edit mode)
 * In Student form, everything except middle_name is required.
 */
export const getStudentValidationSchema = () => {
  return Yup.object().shape({
    first_name: Yup.string()
      .trim()
      .required("First name is required")
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name cannot exceed 50 characters"),

    middle_name: Yup.string()
      .trim()
      .nullable()
      .notRequired()
      .max(50, "Middle name cannot exceed 50 characters"),

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
      .nullable()
      .notRequired()
      .test("is-valid-email", "Please enter a valid email address", (val) => {
        if (!val || val.trim() === "") return true
        return EMAIL_REGEX.test(val.trim())
      })
      .max(100, "Email cannot exceed 100 characters"),

    roll_no: Yup.string()
      .trim()
      .nullable()
      .notRequired()
      .max(50, "Roll number cannot exceed 50 characters"),

    gender: Yup.number()
      .required("Gender is required")
      .oneOf([1, 2, 3], "Please select a valid gender"),

    date_of_birth: Yup.string()
      .required("Date of birth is required"),

    class_name: Yup.string()
      .trim()
      .required("Class / Grade is required")
      .max(50, "Class name cannot exceed 50 characters"),

    section: Yup.string()
      .trim()
      .required("Section is required")
      .max(50, "Section cannot exceed 50 characters"),

    house: Yup.string()
      .trim()
      .required("House is required")
      .max(50, "House cannot exceed 50 characters"),

    father_first_name: Yup.string()
      .trim()
      .required("Father's first name is required")
      .min(2, "Father's first name must be at least 2 characters")
      .max(50, "Father's first name cannot exceed 50 characters"),

    father_last_name: Yup.string()
      .trim()
      .required("Father's last name is required")
      .min(1, "Father's last name must be at least 1 character")
      .max(50, "Father's last name cannot exceed 50 characters"),
  })
}

export default getStudentValidationSchema
