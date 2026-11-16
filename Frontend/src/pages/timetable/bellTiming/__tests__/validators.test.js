import { describe, it, expect } from "vitest"
import {
  validatePeriodTimes,
  validateSchedule,
  validateSetupDayInvariants,
  validateAssignments,
  formatPeriodShortLabel,
  getTimetablePeriodLabel,
  isNonTeachingPeriod,
  sortDays,
  sortSchedules,
  getScheduleMinDayIndex,
  areSchedulesTimingEqual,
  findIdenticalSchedulesInSetups,
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

    it("detects non-adjacent multi-period overlaps using Sweep-Line", () => {
      // P1 covers 08:30-10:30, P2 is 08:45-09:15, P3 is 09:30-10:00
      // P1 overlaps with BOTH P2 and non-adjacent P3
      const sched = {
        periods: [
          { start_time: "08:30", end_time: "10:30", type: PERIOD_TYPES.CLASS, label: "Block" },
          { start_time: "08:45", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:30", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes('Period "Block"') && e.includes('overlaps with "P1"'))).toBe(true)
      expect(res.errors.some((e) => e.includes('Period "Block"') && e.includes('overlaps with "P2"'))).toBe(true)
    })

    it("detects overlaps when periods are entered out of order", () => {
      // Out of order: P2 is entered before P1 in array, but they overlap
      const sched = {
        periods: [
          { start_time: "10:00", end_time: "10:45", type: PERIOD_TYPES.CLASS, label: "P2" },
          { start_time: "09:30", end_time: "10:15", type: PERIOD_TYPES.CLASS, label: "P1" },
        ],
      }
      const res = validateSchedule(sched)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.includes("overlaps with"))).toBe(true)
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

  describe("formatPeriodShortLabel", () => {
    it("formats standard periods with digits: P1, P2, R1, A1, E1", () => {
      expect(formatPeriodShortLabel({ type: PERIOD_TYPES.CLASS, period_number: 1 })).toBe("P1")
      expect(formatPeriodShortLabel({ type: PERIOD_TYPES.CLASS, label: "Period 2" })).toBe("P2")
      expect(formatPeriodShortLabel({ type: PERIOD_TYPES.RECESS, label: "Recess" })).toBe("R1")
      expect(formatPeriodShortLabel({ type: PERIOD_TYPES.ASSEMBLY, label: "Assembly" })).toBe("A1")
      expect(formatPeriodShortLabel({ type: PERIOD_TYPES.ACTIVITY, label: "Extra-curricular" })).toBe("E1")
    })

    it("formats sequential digits across multiple non-class periods when allPeriods is supplied", () => {
      const pR1 = { id: "1", type: PERIOD_TYPES.RECESS, label: "Short Break" }
      const pR2 = { id: "2", type: PERIOD_TYPES.RECESS, label: "Lunch Break" }
      const pA1 = { id: "3", type: PERIOD_TYPES.ASSEMBLY, label: "Morning Assembly" }
      const pE1 = { id: "4", type: PERIOD_TYPES.ACTIVITY, label: "Sports" }
      const pE2 = { id: "5", type: PERIOD_TYPES.ACTIVITY, label: "Music" }
      const all = [pA1, pR1, pR2, pE1, pE2]

      expect(formatPeriodShortLabel(pR1, all)).toBe("R1")
      expect(formatPeriodShortLabel(pR2, all)).toBe("R2")
      expect(formatPeriodShortLabel(pA1, all)).toBe("A1")
      expect(formatPeriodShortLabel(pE1, all)).toBe("E1")
      expect(formatPeriodShortLabel(pE2, all)).toBe("E2")
    })

    it("returns existing short codes directly: E1, E2, A1, R1, P4", () => {
      expect(formatPeriodShortLabel({ label: "E1" })).toBe("E1")
      expect(formatPeriodShortLabel({ label: "E2" })).toBe("E2")
      expect(formatPeriodShortLabel({ label: "A1" })).toBe("A1")
      expect(formatPeriodShortLabel({ label: "R1" })).toBe("R1")
      expect(formatPeriodShortLabel({ label: "P5" })).toBe("P5")
    })

    it("preserves explicit custom labels when hasCustomLabel is true", () => {
      expect(formatPeriodShortLabel({ label: "Homeroom", hasCustomLabel: true, type: PERIOD_TYPES.CLASS })).toBe("Homeroom")
    })
  })

  describe("getTimetablePeriodLabel", () => {
    it("displays full text for Recess, Activity / Extra-curricular, and Assembly instead of R1, E1, A1", () => {
      expect(getTimetablePeriodLabel({ type: PERIOD_TYPES.RECESS, label: "R1" })).toBe("Recess")
      expect(getTimetablePeriodLabel({ type: PERIOD_TYPES.ACTIVITY, label: "E1" })).toBe("Extra-curricular")
      expect(getTimetablePeriodLabel({ type: PERIOD_TYPES.ASSEMBLY, label: "A1" })).toBe("Assembly")
      expect(getTimetablePeriodLabel({ is_break: true, label: "Recess" })).toBe("Recess")
    })

    it("displays numbered full text when multiple non-class periods exist", () => {
      const pR1 = { id: "1", type: PERIOD_TYPES.RECESS, label: "R1" }
      const pR2 = { id: "2", type: PERIOD_TYPES.RECESS, label: "R2" }
      const pE1 = { id: "3", type: PERIOD_TYPES.ACTIVITY, label: "E1" }
      const pE2 = { id: "4", type: PERIOD_TYPES.ACTIVITY, label: "E2" }
      const all = [pR1, pR2, pE1, pE2]

      expect(getTimetablePeriodLabel(pR1, all)).toBe("Recess 1")
      expect(getTimetablePeriodLabel(pR2, all)).toBe("Recess 2")
      expect(getTimetablePeriodLabel(pE1, all)).toBe("Extra-curricular 1")
      expect(getTimetablePeriodLabel(pE2, all)).toBe("Extra-curricular 2")
    })

    it("formats class periods with standard P1, P2", () => {
      expect(getTimetablePeriodLabel({ type: PERIOD_TYPES.CLASS, period_number: 1, label: "P1" })).toBe("P1")
      expect(getTimetablePeriodLabel({ type: PERIOD_TYPES.CLASS, period_number: 2, label: "P2" })).toBe("P2")
    })
  })

  describe("isNonTeachingPeriod", () => {
    it("identifies Recess, Break, Assembly, and Extra-curricular as non-teaching slots", () => {
      expect(isNonTeachingPeriod({ is_break: true })).toBe(true)
      expect(isNonTeachingPeriod({ type: "RECESS" })).toBe(true)
      expect(isNonTeachingPeriod({ period_type: "RECESS" })).toBe(true)
      expect(isNonTeachingPeriod({ type: "ASSEMBLY" })).toBe(true)
      expect(isNonTeachingPeriod({ period_type: "ASSEMBLY" })).toBe(true)
      expect(isNonTeachingPeriod({ label: "Assembly" })).toBe(true)
      expect(isNonTeachingPeriod({ label: "A1" })).toBe(true)
      expect(isNonTeachingPeriod({ type: "ACTIVITY" })).toBe(true)
      expect(isNonTeachingPeriod({ type: "EXTRA_CURRICULAR" })).toBe(true)
      expect(isNonTeachingPeriod({ label: "Extra-curricular" })).toBe(true)
      expect(isNonTeachingPeriod({ label: "E1" })).toBe(true)
    })

    it("identifies Class periods as teaching slots", () => {
      expect(isNonTeachingPeriod({ type: "CLASS", period_number: 1, is_break: false })).toBe(false)
      expect(isNonTeachingPeriod({ type: "CLASS", label: "Period 1", is_break: false })).toBe(false)
      expect(isNonTeachingPeriod({ period_type: "CLASS", label: "P1", is_break: false })).toBe(false)
      expect(isNonTeachingPeriod(null)).toBe(false)
    })
  })

  describe("Day and Schedule Sorting & Invariants", () => {
    it("sortDays sorts weekdays in standard chronological order", () => {
      const unsorted = ["FRIDAY", "MONDAY", "SATURDAY", "WEDNESDAY", "TUESDAY", "THURSDAY"]
      expect(sortDays(unsorted)).toEqual([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ])
    })

    it("sortSchedules sorts schedules by earliest day", () => {
      const schedules = [
        { id: "s-sat", days: ["SATURDAY"] },
        { id: "s-tue", days: ["TUESDAY"] },
        { id: "s-mon", days: ["MONDAY", "WEDNESDAY", "THURSDAY"] },
        { id: "s-fri", days: ["FRIDAY"] },
      ]
      const sorted = sortSchedules(schedules)
      expect(sorted.map((s) => s.id)).toEqual(["s-mon", "s-tue", "s-fri", "s-sat"])
    })
  })

  describe("Duplicate Bell Timings Detection & Auto-Merge", () => {
    const basePeriods = [
      { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
      { start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
      { start_time: "10:00", end_time: "10:15", type: PERIOD_TYPES.RECESS, is_break: true, label: "R1" },
      { start_time: "10:15", end_time: "11:00", type: PERIOD_TYPES.CLASS, label: "P3" },
    ]

    it("areSchedulesTimingEqual returns true when periods and timings match identically", () => {
      const schedA = { id: "a", periods: basePeriods }
      const schedB = {
        id: "b",
        periods: [
          { start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS, label: "P1" },
          { start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS, label: "P2" },
          { start_time: "10:00", end_time: "10:15", type: PERIOD_TYPES.RECESS, is_break: true, label: "R1" },
          { start_time: "10:15", end_time: "11:00", type: PERIOD_TYPES.CLASS, label: "P3" },
        ],
      }
      expect(areSchedulesTimingEqual(schedA, schedB)).toBe(true)
    })

    it("areSchedulesTimingEqual matches across HH:MM and HH:MM:SS formats", () => {
      const schedA = {
        id: "a",
        periods: [
          { period_number: 1, start_time: "08:30:00", end_time: "09:15:00", type: PERIOD_TYPES.CLASS },
          { period_number: 2, start_time: "09:15:00", end_time: "10:00:00", type: PERIOD_TYPES.CLASS },
        ],
      }
      const schedB = {
        id: "b",
        periods: [
          { period_number: 1, start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS },
          { period_number: 2, start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS },
        ],
      }
      expect(areSchedulesTimingEqual(schedA, schedB)).toBe(true)
    })

    it("areSchedulesTimingEqual matches even if periods array order is unsorted", () => {
      const schedA = {
        id: "a",
        periods: [
          { period_number: 2, start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS },
          { period_number: 1, start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS },
        ],
      }
      const schedB = {
        id: "b",
        periods: [
          { period_number: 1, start_time: "08:30", end_time: "09:15", type: PERIOD_TYPES.CLASS },
          { period_number: 2, start_time: "09:15", end_time: "10:00", type: PERIOD_TYPES.CLASS },
        ],
      }
      expect(areSchedulesTimingEqual(schedA, schedB)).toBe(true)
    })

    it("areSchedulesTimingEqual returns false when timings or types differ", () => {
      const schedA = { id: "a", periods: basePeriods }
      const schedDiffTime = {
        id: "b",
        periods: [
          { start_time: "08:00", end_time: "08:45", type: PERIOD_TYPES.CLASS, label: "P1" },
          ...basePeriods.slice(1),
        ],
      }
      expect(areSchedulesTimingEqual(schedA, schedDiffTime)).toBe(false)

      const schedDiffCount = { id: "c", periods: basePeriods.slice(0, 2) }
      expect(areSchedulesTimingEqual(schedA, schedDiffCount)).toBe(false)
    })

    it("findIdenticalSchedulesInSetups finds split day having same timings as main schedule", () => {
      const setups = [
        {
          id: "setup-1",
          name: "Primary Wing",
          schedules: [
            {
              id: "sch-main",
              days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"],
              periods: basePeriods,
            },
            {
              id: "sch-friday",
              days: ["FRIDAY"],
              periods: JSON.parse(JSON.stringify(basePeriods)),
            },
          ],
        },
      ]

      const duplicates = findIdenticalSchedulesInSetups(setups)
      expect(duplicates.length).toBe(1)
      expect(duplicates[0].setupId).toBe("setup-1")
      expect(duplicates[0].sourceScheduleId).toBe("sch-friday")
      expect(duplicates[0].sourceDays).toEqual(["FRIDAY"])
      expect(duplicates[0].targetScheduleId).toBe("sch-main")
      expect(duplicates[0].targetDays).toEqual(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"])
    })
  })
})

