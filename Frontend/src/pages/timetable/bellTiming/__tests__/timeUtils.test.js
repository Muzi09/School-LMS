import { describe, it, expect } from "vitest"
import {
  parseTime,
  formatMinutes,
  format12h,
  format24h,
  calculateDuration,
  addMinutesToTime,
  formatDurationHuman,
} from "../timeUtils"

describe("timeUtils", () => {
  describe("parseTime lenient parser", () => {
    it("parses single digit hours", () => {
      expect(parseTime("9")).toEqual({
        hours: 9,
        minutes: 0,
        totalMinutes: 540,
        normalized: "09:00",
      })
    })

    it("parses 3-digit strings e.g. 930", () => {
      expect(parseTime("930")).toEqual({
        hours: 9,
        minutes: 30,
        totalMinutes: 570,
        normalized: "09:30",
      })
    })

    it("parses standard 24h strings e.g. 09:30 and 21:30", () => {
      expect(parseTime("09:30")?.normalized).toBe("09:30")
      expect(parseTime("21:30")).toEqual({
        hours: 21,
        minutes: 30,
        totalMinutes: 1290,
        normalized: "21:30",
      })
    })

    it("parses 12h strings with AM/PM e.g. 9:30 am, 12 AM, 12 PM", () => {
      expect(parseTime("9:30 am")?.normalized).toBe("09:30")
      expect(parseTime("9:30 pm")?.normalized).toBe("21:30")
      expect(parseTime("12 am")?.normalized).toBe("00:00")
      expect(parseTime("12 pm")?.normalized).toBe("12:00")
      expect(parseTime("12:00 AM")?.normalized).toBe("00:00")
      expect(parseTime("12:00 PM")?.normalized).toBe("12:00")
    })

    it("returns null for invalid inputs", () => {
      expect(parseTime("25:00")).toBeNull()
      expect(parseTime("abc")).toBeNull()
      expect(parseTime("")).toBeNull()
      expect(parseTime(null)).toBeNull()
      expect(parseTime("14:75")).toBeNull()
    })
  })

  describe("format12h and format24h roundtrips", () => {
    it("formats 12h display properly", () => {
      expect(format12h("08:30")).toBe("8:30 AM")
      expect(format12h("12:00")).toBe("12:00 PM")
      expect(format12h("13:15")).toBe("1:15 PM")
      expect(format12h("00:00")).toBe("12:00 AM")
    })

    it("round-trips 12h display back to normalized 24h", () => {
      const times = ["08:30", "12:00", "13:15", "00:00", "21:45"]
      times.forEach((t) => {
        const display12 = format12h(t)
        const parsed = parseTime(display12)
        expect(parsed?.normalized).toBe(t)
      })
    })
  })

  describe("calculateDuration & addMinutesToTime", () => {
    it("calculates positive duration", () => {
      expect(calculateDuration("08:30", "09:15")).toBe(45)
      expect(calculateDuration("09:15", "10:00")).toBe(45)
      expect(calculateDuration("11:30", "11:45")).toBe(15)
    })

    it("returns negative if end < start", () => {
      expect(calculateDuration("09:15", "08:30")).toBe(-45)
    })

    it("adds minutes correctly", () => {
      expect(addMinutesToTime("08:30", 45)).toBe("09:15")
      expect(addMinutesToTime("11:45", 30)).toBe("12:15")
    })

    it("formats human duration", () => {
      expect(formatDurationHuman(45)).toBe("45m")
      expect(formatDurationHuman(60)).toBe("1h")
      expect(formatDurationHuman(75)).toBe("1h 15m")
    })
  })
})

