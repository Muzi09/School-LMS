import { describe, it, expect } from "vitest"
import {
  validatePeriodTimes,
  validateSchedule,
  validateSetupDayInvariants,
  validateAssignments,
  MIN_PERIOD_DURATION_MINUTES,
  MAX_PERIOD_DURATION_MINUTES,
  PERIOD_TYPES,
} from "../validators"

describe("validators", () => {
  describe("validatePeriodTimes", () => {
    it("accepts valid period times", () => {
      expect(validatePeriodTimes({ start_time: "08:30", end_time: "09:15" })).toEqual([])
    })

    it("rejects end <= start (same time or crossing midnight)", () => {
      const errEqual = validatePeriodTimes({ start_time: "09:00", end_time: "09:00" })
      expect(errEqual.some((e) => e.includes("End time must be after start time"))).toBe(true)

      const errMidnight = validatePeriodTimes({ start_time: "23:00", end_time: "01:00" })
      expect(errMidnight.some((e) => e.includes("End time must be after start time"))).toBe(true)
    })

    it("rejects durations below minimum or above maximum", () => {
      const errUnder = validatePeriodTimes({ start_time: "09:00", end_time: "09:02" })
      expect(errUnder.some((e) => e.includes(`at least ${MIN_PERIOD_DURATION_MINUTES} minutes`))).toBe(true)

      const errOver = validatePeriodTimes({ start_time: "08:00", end_time: "12:00" })
      expect(errOver.some((e) => e.includes(`cannot exceed ${MAX_PERIOD_DURATION_MINUTES} minutes`))).toBe(true)
    })
  })

  describe("validateSchedule", () => {
    it("allows touching edges (consecutive periods with 0 gap)", () => {
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(true)
      expect(res.errors).toEqual([])
    })

    it("rejects 1-minute overlap between consecutive periods", () => {
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "09:16", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes("overlaps with"))).toBe(true)
    })

    it("rejects identical times and fully contained periods", () => {
      const schedIdentical = {
        periods: [
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      expect(validateSchedule(schedIdentical).isValid).toBe(false)

      const schedContained = {
        periods: [
          { start_time: "08:30", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:00", end_time: "09:30", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      expect(validateSchedule(schedContained).isValid).toBe(false)
    })

    it("detects gaps and generates warnings with gap details", () => {
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:30", end_time: "10:15", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(true)
      expect(res.gaps.length).toBe(1)
      expect(res.gaps[0].gapMinutes).toBe(15)
      expect(res.warnings[0]).toContain("Gap of 15m")
    })

    it("requires at least 1 Class period", () => {
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "08:45", type: PERIOD_TYPES.RECESS, label: "Recess" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes("needs at least 1 Class period"))).toBe(true)
    })

    it("rejects duplicate labels", () => {
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P1" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes('Duplicate period label "P1"'))).toBe(true)
    })
  })

  describe("validateSetupDayInvariants", () => {
    const workingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

    it("passes when all working days are present exactly once", () => {
      const setup = {
        name: "Setup 1",
        schedules: [
          { id: "s1", days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] },
          { id: "s2", days: ["SATURDAY"] },
        ],
      }
      const res = validateSetupDayInvariants(setup, workingDays)
      expect(res.isValid).toBe(true)
      expect(res.errors).toEqual([])
    })

    it("fails when a working day is orphaned", () => {
      const setup = {
        name: "Setup 1",
        schedules: [
          { id: "s1", days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] },
        ],
      }
      const res = validateSetupDayInvariants(setup, workingDays)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes('Day "SATURDAY" is not assigned'))).toBe(true)
    })

    it("fails when a working day is duplicated across schedules", () => {
      const setup = {
        name: "Setup 1",
        schedules: [
          { id: "s1", days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] },
          { id: "s2", days: ["SATURDAY"] },
        ],
      }
      const res = validateSetupDayInvariants(setup, workingDays)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes('Day "SATURDAY" is duplicated'))).toBe(true)
    })
  })

  describe("validateAssignments", () => {
    const allSections = [
      { id: "sec-1", name: "A" },
      { id: "sec-2", name: "B" },
    ]
    const setups = [{ id: "setup-1" }]

    it("passes when all sections are assigned to a valid setup", () => {
      const assignments = { "sec-1": "setup-1", "sec-2": "setup-1" }
      const res = validateAssignments(allSections, assignments, setups)
      expect(res.isValid).toBe(true)
      expect(res.errors).toEqual([])
    })

    it("fails when any section is orphaned", () => {
      const assignments = { "sec-1": "setup-1" }
      const res = validateAssignments(allSections, assignments, setups)
      expect(res.isValid).toBe(false)
      expect(res.orphanSections.length).toBe(1)
      expect(res.orphanSections[0].id).toBe("sec-2")
    })
  })
})

