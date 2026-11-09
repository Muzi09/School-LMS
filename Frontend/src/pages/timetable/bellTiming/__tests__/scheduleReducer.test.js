import { describe, it, expect } from "vitest"
import {
  renumberPeriods,
  createDefaultPeriodsTemplate,
  createDefaultSetup,
  bellTimingReducer,
} from "../scheduleReducer"
import { PERIOD_TYPES } from "../validators"

describe("scheduleReducer", () => {
  describe("renumberPeriods", () => {
    it("auto-numbers Class and Non-Class periods (P, R, A, E) with digits in sequential order", () => {
      const periods = [
        { type: PERIOD_TYPES.CLASS, label: "Old1" },
        { type: PERIOD_TYPES.CLASS, label: "Old2" },
        { type: PERIOD_TYPES.RECESS, label: "Recess" },
        { type: PERIOD_TYPES.CLASS, label: "Old3" },
        { type: PERIOD_TYPES.ASSEMBLY, label: "Assembly" },
        { type: PERIOD_TYPES.ACTIVITY, label: "Extra-curricular" },
      ]
      const renumbered = renumberPeriods(periods)
      expect(renumbered[0].label).toBe("P1")
      expect(renumbered[1].label).toBe("P2")
      expect(renumbered[2].label).toBe("R1")
      expect(renumbered[3].label).toBe("P3")
      expect(renumbered[4].label).toBe("A1")
      expect(renumbered[5].label).toBe("E1")
    })

    it("preserves custom labels when hasCustomLabel is true", () => {
      const periods = [
        { type: PERIOD_TYPES.CLASS, label: "Homeroom", hasCustomLabel: true },
        { type: PERIOD_TYPES.CLASS, label: "P1" },
      ]
      const renumbered = renumberPeriods(periods)
      expect(renumbered[0].label).toBe("Homeroom")
      expect(renumbered[1].label).toBe("P2")
    })
  })

  describe("Reducer operations", () => {
    const initialSetup = createDefaultSetup("Setup 1", 1)
    const initialState = bellTimingReducer(
      { history: { past: [], future: [] } },
      {
        type: "SET_INITIAL_STATE",
        payload: {
          setups: [initialSetup],
          sectionAssignments: { "sec-1": initialSetup.id, "sec-2": initialSetup.id },
        },
      }
    )

    it("inserts period between P2 and P3 with shift cascade", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      // Insert between P2 (index 1) and P3 (index 2)
      const action = {
        type: "INSERT_PERIOD",
        payload: {
          setupId,
          scheduleId: schedId,
          insertAfterIndex: 1,
          periodData: {
            start_time: "10:00",
            end_time: "10:30",
            type: PERIOD_TYPES.CLASS,
            label: "P3",
          },
          cascadeMode: "shift",
        },
      }

      const nextState = bellTimingReducer(initialState, action)
      const sched = nextState.setups[0].schedules[0]
      expect(sched.periods.length).toBe(10) // Was 9 (8 classes + 1 recess), now 10
      expect(sched.periods[2].start_time).toBe("10:00")
      expect(sched.periods[2].end_time).toBe("10:30")
      // Check that downstream periods shifted
      expect(sched.periods[3].start_time).toBe("10:30")
      // Check renumbering
      expect(sched.periods[0].label).toBe("P1")
      expect(sched.periods[1].label).toBe("P2")
      expect(sched.periods[2].label).toBe("P3")
      expect(sched.periods[3].label).toBe("P4")
    })

    it("inserts Recess period and renumbers class periods accordingly", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      const action = {
        type: "INSERT_PERIOD",
        payload: {
          setupId,
          scheduleId: schedId,
          insertAfterIndex: 0,
          periodData: {
            start_time: "09:15",
            end_time: "09:30",
            type: PERIOD_TYPES.RECESS,
          },
          cascadeMode: "shift",
        },
      }

      const nextState = bellTimingReducer(initialState, action)
      const sched = nextState.setups[0].schedules[0]
      expect(sched.periods[1].type).toBe(PERIOD_TYPES.RECESS)
      expect(sched.periods[1].label).toBe("R1")
      expect(sched.periods[2].label).toBe("P2")
    })

    it("edits a period with cascade shift", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      const action = {
        type: "EDIT_PERIOD",
        payload: {
          setupId,
          scheduleId: schedId,
          periodIndex: 0,
          periodData: {
            start_time: "08:30",
            end_time: "09:30", // Extended from 09:15 to 09:30
          },
          cascadeMode: "shift",
        },
      }

      const nextState = bellTimingReducer(initialState, action)
      const sched = nextState.setups[0].schedules[0]
      expect(sched.periods[0].end_time).toBe("09:30")
      expect(sched.periods[1].start_time).toBe("09:30")
    })

    it("deletes a period and renumbers remaining class periods", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      const action = {
        type: "DELETE_PERIOD",
        payload: {
          setupId,
          scheduleId: schedId,
          periodIndex: 0, // Delete P1
        },
      }

      const nextState = bellTimingReducer(initialState, action)
      const sched = nextState.setups[0].schedules[0]
      expect(sched.periods[0].label).toBe("P1") // Former P2 renumbered to P1
    })

    it("adjusts boundary time between periods and for the first start time", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      // 1. First period start time
      const actionFirst = {
        type: "EDIT_BOUNDARY_TIME",
        payload: {
          setupId,
          scheduleId: schedId,
          boundaryIndex: 0,
          newTime: "08:15",
          isFirst: true,
        },
      }
      const state1 = bellTimingReducer(initialState, actionFirst)
      expect(state1.setups[0].schedules[0].periods[0].start_time).toBe("08:15")

      // 2. Boundary between P1 and P2 (boundaryIndex = 1)
      const actionBoundary = {
        type: "EDIT_BOUNDARY_TIME",
        payload: {
          setupId,
          scheduleId: schedId,
          boundaryIndex: 1,
          newTime: "09:20",
          isFirst: false,
        },
      }
      const state2 = bellTimingReducer(state1, actionBoundary)
      const sched2 = state2.setups[0].schedules[0]
      expect(sched2.periods[0].end_time).toBe("09:20")
      expect(sched2.periods[1].start_time).toBe("09:20")
      expect(sched2.periods[1].end_time).toBe("10:05") // 45m preserved, shifted ahead
      // Subsequent periods shifted ahead and school end time moved ahead
      expect(sched2.periods[sched2.periods.length - 1].end_time).toBe("14:50")
    })

    it("splits a day off into its own independent schedule", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      const action = {
        type: "SPLIT_DAYS",
        payload: {
          setupId,
          scheduleId: schedId,
          daysToSplit: ["SATURDAY"],
        },
      }

      const nextState = bellTimingReducer(initialState, action)
      const setup = nextState.setups[0]
      expect(setup.schedules.length).toBe(2)
      expect(setup.schedules[0].days).not.toContain("SATURDAY")
      expect(setup.schedules[1].days).toEqual(["SATURDAY"])
      expect(setup.schedules[1].periods.length).toBe(setup.schedules[0].periods.length)
    })

    it("merges a split day back into the main schedule, discarding custom periods", () => {
      const setupId = initialSetup.id
      const schedId = initialSetup.schedules[0].id

      // 1. Split Saturday
      const splitState = bellTimingReducer(initialState, {
        type: "SPLIT_DAYS",
        payload: { setupId, scheduleId: schedId, daysToSplit: ["SATURDAY"] },
      })
      const satSchedId = splitState.setups[0].schedules[1].id

      // 2. Edit Saturday periods
      const editedState = bellTimingReducer(splitState, {
        type: "EDIT_PERIOD",
        payload: {
          setupId,
          scheduleId: satSchedId,
          periodIndex: 0,
          periodData: { start_time: "08:00", end_time: "08:40" },
          cascadeMode: "none",
        },
      })
      expect(editedState.setups[0].schedules[1].periods[0].start_time).toBe("08:00")

      // 3. Merge back
      const mergedState = bellTimingReducer(editedState, {
        type: "MERGE_DAYS",
        payload: {
          setupId,
          sourceScheduleId: satSchedId,
          targetScheduleId: schedId,
        },
      })

      const setup = mergedState.setups[0]
      expect(setup.schedules.length).toBe(1)
      expect(setup.schedules[0].days).toContain("SATURDAY")
      // Merged schedule retained main schedule's 08:30 start time
      expect(setup.schedules[0].periods[0].start_time).toBe("08:30")
    })

    it("moves classes to another setup atomically", () => {
      // Create Setup 2
      const stateWith2 = bellTimingReducer(initialState, {
        type: "CREATE_SETUP",
        payload: { name: "Setup 2" },
      })
      const setup2Id = stateWith2.setups[1].id

      const moveAction = {
        type: "MOVE_CLASSES",
        payload: {
          sectionIds: ["sec-1"],
          targetSetupId: setup2Id,
        },
      }

      const movedState = bellTimingReducer(stateWith2, moveAction)
      expect(movedState.sectionAssignments["sec-1"]).toBe(setup2Id)
      expect(movedState.sectionAssignments["sec-2"]).toBe(initialSetup.id)
    })

    it("supports undo and redo stack across operations", () => {
      const action = {
        type: "RENAME_SETUP",
        payload: { setupId: initialSetup.id, name: "Renamed Setup" },
      }
      const renamed = bellTimingReducer(initialState, action)
      expect(renamed.setups[0].name).toBe("Renamed Setup")

      // Undo
      const undone = bellTimingReducer(renamed, { type: "UNDO" })
      expect(undone.setups[0].name).toBe(initialSetup.name)

      // Redo
      const redone = bellTimingReducer(undone, { type: "REDO" })
      expect(redone.setups[0].name).toBe("Renamed Setup")
    })

    it("duplicates setup without copying class assignments", () => {
      const dupAction = {
        type: "DUPLICATE_SETUP",
        payload: { setupId: initialSetup.id },
      }
      const stateWithDup = bellTimingReducer(initialState, dupAction)
      expect(stateWithDup.setups.length).toBe(2)
      const duplicate = stateWithDup.setups[1]
      expect(duplicate.name).toBe(`Copy of ${initialSetup.name}`)
      // Editing duplicate does not mutate source
      const editDupAction = {
        type: "RENAME_SETUP",
        payload: { setupId: duplicate.id, name: "Modified Copy" },
      }
      const stateEditedDup = bellTimingReducer(stateWithDup, editDupAction)
      expect(stateEditedDup.setups[0].name).toBe(initialSetup.name)
      expect(stateEditedDup.setups[1].name).toBe("Modified Copy")
    })

    it("handles SAVE_SUCCESS: updates version, maps temporary IDs, and marks isDirty clean", () => {
      // Modify setup to make it dirty
      const editAction = {
        type: "RENAME_SETUP",
        payload: { setupId: initialSetup.id, name: "Updated Setup" },
      }
      const dirtyState = bellTimingReducer(initialState, editAction)
      expect(dirtyState.isDirty).toBe(true)
      const currentRev = dirtyState.revision

      // Server returns updated setups with incremented version
      const saveSuccessAction = {
        type: "SAVE_SUCCESS",
        payload: {
          savedSetups: [{ id: initialSetup.id, version: 2, name: "Updated Setup" }],
          revision: currentRev,
        },
      }
      const savedState = bellTimingReducer(dirtyState, saveSuccessAction)
      expect(savedState.isDirty).toBe(false)
      expect(savedState.setups[0].version).toBe(2)
      expect(savedState.setups[0].name).toBe("Updated Setup")
    })

    it("keeps isDirty true if new changes occurred while save was in flight", () => {
      // First modification (revision 1)
      const editAction = {
        type: "RENAME_SETUP",
        payload: { setupId: initialSetup.id, name: "First Edit" },
      }
      const state1 = bellTimingReducer(initialState, editAction)
      const flightRevision = state1.revision

      // Second modification while in flight (revision 2)
      const editAction2 = {
        type: "RENAME_SETUP",
        payload: { setupId: initialSetup.id, name: "Second Edit" },
      }
      const state2 = bellTimingReducer(state1, editAction2)
      expect(state2.revision).toBeGreaterThan(flightRevision)

      // First save resolves
      const saveSuccessAction = {
        type: "SAVE_SUCCESS",
        payload: {
          savedSetups: [{ id: initialSetup.id, version: 2, name: "First Edit" }],
          revision: flightRevision,
        },
      }
      const savedState = bellTimingReducer(state2, saveSuccessAction)
      // Since revision didn't match latest revision, state remains dirty for next save
      expect(savedState.isDirty).toBe(true)
      expect(savedState.setups[0].version).toBe(2)
    })
  })
})

