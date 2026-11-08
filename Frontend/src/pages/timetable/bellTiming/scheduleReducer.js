/**
 * Bell Timing Schedule Reducer & State Management
 * Framework-agnostic pure logic with full undo/redo capabilities.
 */

import {
  parseTime,
  formatMinutes,
  addMinutesToTime,
  calculateDuration,
} from "./timeUtils"
import {
  MIN_PERIOD_DURATION_MINUTES,
  PERIOD_TYPES,
  ALL_WEEKDAYS,
} from "./validators"

/**
 * Renumbers periods in sequential order:
 * Class periods: P1, P2, P3...
 * Recess periods: R1, R2, R3...
 * Assembly periods: A1, A2, A3...
 * Extra-curricular periods: E1, E2, E3...
 */
export function renumberPeriods(periods = []) {
  let classCounter = 1
  let recessCounter = 1
  let assemblyCounter = 1
  let extraCounter = 1

  return periods.map((p, idx) => {
    const pType = p.type || (p.is_break ? PERIOD_TYPES.RECESS : PERIOD_TYPES.CLASS)
    const isClass = pType === PERIOD_TYPES.CLASS

    // Determine label
    let label = p.label
    const isStandardLabel =
      !label ||
      /^[PRAE]\d+$/i.test(label) ||
      /^period\s*\d+$/i.test(label) ||
      /^recess(\s*\d+)?$/i.test(label) ||
      /^assembly(\s*\d+)?$/i.test(label) ||
      /^(activity|extra-curricular|extracurricular)(\s*\d+)?$/i.test(label)

    if (isClass) {
      if (isStandardLabel || !p.hasCustomLabel) {
        label = `P${classCounter}`
      }
      classCounter += 1
    } else if (pType === PERIOD_TYPES.RECESS) {
      if (isStandardLabel || !p.hasCustomLabel) {
        label = `R${recessCounter}`
      }
      recessCounter += 1
    } else if (pType === PERIOD_TYPES.ASSEMBLY) {
      if (isStandardLabel || !p.hasCustomLabel) {
        label = `A${assemblyCounter}`
      }
      assemblyCounter += 1
    } else if (pType === PERIOD_TYPES.ACTIVITY) {
      if (isStandardLabel || !p.hasCustomLabel) {
        label = `E${extraCounter}`
      }
      extraCounter += 1
    } else {
      if (isStandardLabel || !p.hasCustomLabel) {
        label = pType.charAt(0) + pType.slice(1).toLowerCase()
      }
    }

    return {
      ...p,
      period_number: idx + 1,
      type: pType,
      is_break: pType === PERIOD_TYPES.RECESS,
      label,
    }
  })
}

/**
 * Creates default standard periods template (8 periods, 45m each with 15m recess after P4).
 */
export function createDefaultPeriodsTemplate(startTimeStr = "08:30", periodDuration = 45, recessDuration = 15) {
  let currentStart = startTimeStr
  const periods = []

  // P1 - P4
  for (let i = 1; i <= 4; i++) {
    const end = addMinutesToTime(currentStart, periodDuration)
    periods.push({
      id: `p-${i}-${Date.now()}`,
      period_number: i,
      type: PERIOD_TYPES.CLASS,
      is_break: false,
      label: `P${i}`,
      start_time: currentStart,
      end_time: end,
    })
    currentStart = end
  }

  // Recess
  const recessEnd = addMinutesToTime(currentStart, recessDuration)
  periods.push({
    id: `recess-${Date.now()}`,
    period_number: 5,
    type: PERIOD_TYPES.RECESS,
    is_break: true,
    label: "R1",
    start_time: currentStart,
    end_time: recessEnd,
  })
  currentStart = recessEnd

  // P5 - P8
  for (let i = 5; i <= 8; i++) {
    const end = addMinutesToTime(currentStart, periodDuration)
    periods.push({
      id: `p-${i}-${Date.now()}`,
      period_number: periods.length + 1,
      type: PERIOD_TYPES.CLASS,
      is_break: false,
      label: `P${i}`,
      start_time: currentStart,
      end_time: end,
    })
    currentStart = end
  }

  return renumberPeriods(periods)
}

/**
 * Initial empty / default setup generator.
 */
export function createDefaultSetup(name = "Setup 1", index = 1, workingDays = ALL_WEEKDAYS) {
  const setupId = `setup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  const scheduleId = `sched-${Date.now()}-1`
  return {
    id: setupId,
    name,
    order: index,
    description: "",
    is_default: index === 1,
    schedules: [
      {
        id: scheduleId,
        days: [...workingDays],
        periods: createDefaultPeriodsTemplate(),
      },
    ],
  }
}

/**
 * Deep clones setups and assignments for history.
 */
function cloneState(state) {
  return {
    setups: JSON.parse(JSON.stringify(state.setups)),
    sectionAssignments: { ...state.sectionAssignments },
    activeSetupId: state.activeSetupId,
    activeScheduleId: state.activeScheduleId,
  }
}

/**
 * Reducer function for all bell timing operations.
 */
export function bellTimingReducer(state, action) {
  const pushHistory = (newState) => {
    const past = [...state.history.past, cloneState(state)]
    if (past.length > 30) past.shift()
    return {
      ...newState,
      isDirty: true,
      revision: (state.revision || 0) + 1,
      history: {
        past,
        future: [],
      },
    }
  }

  switch (action.type) {
    case "SET_INITIAL_STATE": {
      const { setups, sectionAssignments, activeSetupId } = action.payload
      const firstSetupId = setups[0]?.id
      const initialActiveSetup = activeSetupId || firstSetupId
      const initialActiveSched = setups[0]?.schedules[0]?.id || null

      return {
        setups,
        sectionAssignments: sectionAssignments || {},
        activeSetupId: initialActiveSetup,
        activeScheduleId: initialActiveSched,
        isDirty: false,
        revision: 0,
        history: { past: [], future: [] },
      }
    }

    case "UNDO": {
      if (state.history.past.length === 0) return state
      const previous = state.history.past[state.history.past.length - 1]
      const newPast = state.history.past.slice(0, -1)
      const newFuture = [cloneState(state), ...state.history.future]

      return {
        ...state,
        setups: previous.setups,
        sectionAssignments: previous.sectionAssignments,
        activeSetupId: previous.activeSetupId,
        activeScheduleId: previous.activeScheduleId,
        isDirty: true,
        revision: (state.revision || 0) + 1,
        history: {
          past: newPast,
          future: newFuture,
        },
      }
    }

    case "REDO": {
      if (state.history.future.length === 0) return state
      const next = state.history.future[0]
      const newFuture = state.history.future.slice(1)
      const newPast = [...state.history.past, cloneState(state)]

      return {
        ...state,
        setups: next.setups,
        sectionAssignments: next.sectionAssignments,
        activeSetupId: next.activeSetupId,
        activeScheduleId: next.activeScheduleId,
        isDirty: true,
        revision: (state.revision || 0) + 1,
        history: {
          past: newPast,
          future: newFuture,
        },
      }
    }

    case "SELECT_SETUP": {
      const setup = state.setups.find((s) => s.id === action.payload.setupId)
      return {
        ...state,
        activeSetupId: action.payload.setupId,
        activeScheduleId: setup?.schedules[0]?.id || null,
      }
    }

    case "SELECT_SCHEDULE": {
      return {
        ...state,
        activeScheduleId: action.payload.scheduleId,
      }
    }

    case "CREATE_SETUP": {
      const nextIdx = state.setups.length + 1
      const newSetup = createDefaultSetup(action.payload?.name || `Setup ${nextIdx}`, nextIdx)
      // If templateSetupId is passed, copy its timings
      if (action.payload?.sourceSetupId) {
        const source = state.setups.find((s) => s.id === action.payload.sourceSetupId)
        if (source) {
          newSetup.schedules = JSON.parse(JSON.stringify(source.schedules)).map((sch, i) => ({
            ...sch,
            id: `sched-${Date.now()}-${i}`,
            periods: sch.periods.map((p, pIdx) => ({
              ...p,
              id: `p-${Date.now()}-${pIdx}`,
            })),
          }))
        }
      }

      return pushHistory({
        ...state,
        setups: [...state.setups, newSetup],
        activeSetupId: newSetup.id,
        activeScheduleId: newSetup.schedules[0]?.id || null,
      })
    }

    case "CREATE_AND_MOVE": {
      const nextIdx = state.setups.length + 1
      const newSetup = createDefaultSetup(action.payload?.name || `Setup ${nextIdx}`, nextIdx)
      if (action.payload?.sourceSetupId) {
        const source = state.setups.find((s) => s.id === action.payload.sourceSetupId)
        if (source) {
          newSetup.schedules = JSON.parse(JSON.stringify(source.schedules)).map((sch, i) => ({
            ...sch,
            id: `sched-${Date.now()}-${i}`,
            periods: sch.periods.map((p, pIdx) => ({
              ...p,
              id: `p-${Date.now()}-${pIdx}`,
            })),
          }))
        }
      }

      const nextAssignments = { ...state.sectionAssignments }
      const sectionIds = action.payload?.sectionIds || []
      sectionIds.forEach((secId) => {
        nextAssignments[secId] = newSetup.id
      })

      return pushHistory({
        ...state,
        setups: [...state.setups, newSetup],
        sectionAssignments: nextAssignments,
        activeSetupId: newSetup.id,
        activeScheduleId: newSetup.schedules[0]?.id || null,
      })
    }

    case "RENAME_SETUP": {
      const { setupId, name } = action.payload
      const nextSetups = state.setups.map((s) => (s.id === setupId ? { ...s, name } : s))
      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "DUPLICATE_SETUP": {
      const { setupId } = action.payload
      const source = state.setups.find((s) => s.id === setupId)
      if (!source) return state

      const nextIdx = state.setups.length + 1
      const newId = `setup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const duplicated = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        name: `Copy of ${source.name}`,
        order: nextIdx,
        is_default: false,
        schedules: source.schedules.map((sch, i) => ({
          ...JSON.parse(JSON.stringify(sch)),
          id: `sched-${Date.now()}-${i}`,
          periods: sch.periods.map((p, pIdx) => ({
            ...p,
            id: `p-${Date.now()}-${pIdx}`,
          })),
        })),
      }

      return pushHistory({
        ...state,
        setups: [...state.setups, duplicated],
        activeSetupId: newId,
        activeScheduleId: duplicated.schedules[0]?.id || null,
      })
    }

    case "DELETE_SETUP": {
      const { setupId } = action.payload
      if (state.setups.length <= 1) return state

      const remaining = state.setups.filter((s) => s.id !== setupId)
      const nextActiveId = state.activeSetupId === setupId ? remaining[0]?.id : state.activeSetupId
      const activeSetup = remaining.find((s) => s.id === nextActiveId)

      return pushHistory({
        ...state,
        setups: remaining,
        activeSetupId: nextActiveId,
        activeScheduleId: activeSetup?.schedules[0]?.id || null,
      })
    }

    case "INSERT_PERIOD": {
      const { setupId, scheduleId, insertAfterIndex, periodData, cascadeMode = "shift" } = action.payload
      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const nextSchedules = setup.schedules.map((sch) => {
          if (sch.id !== scheduleId) return sch

          let periods = [...sch.periods]
          const insertIdx = insertAfterIndex === -1 ? 0 : insertAfterIndex + 1

          const newPeriod = {
            id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            period_number: insertIdx + 1,
            type: periodData.type || PERIOD_TYPES.CLASS,
            is_break: periodData.type === PERIOD_TYPES.RECESS,
            label: periodData.label || `P${insertIdx + 1}`,
            start_time: periodData.start_time,
            end_time: periodData.end_time,
            hasCustomLabel: Boolean(periodData.hasCustomLabel),
          }

          periods.splice(insertIdx, 0, newPeriod)

          // Handle cascade
          if (cascadeMode === "shift") {
            let lastEnd = parseTime(newPeriod.end_time).totalMinutes
            for (let i = insertIdx + 1; i < periods.length; i++) {
              const p = { ...periods[i] }
              const dur = calculateDuration(p.start_time, p.end_time)
              p.start_time = formatMinutes(lastEnd)
              lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
              p.end_time = formatMinutes(lastEnd)
              periods[i] = p
            }
          } else if (cascadeMode === "fixed_end" && insertIdx + 1 < periods.length) {
            // Squeeze the next period
            const nextP = { ...periods[insertIdx + 1] }
            nextP.start_time = newPeriod.end_time
            const squeezedDuration = calculateDuration(nextP.start_time, nextP.end_time)
            if (squeezedDuration >= MIN_PERIOD_DURATION_MINUTES) {
              periods[insertIdx + 1] = nextP
            }
          }

          return {
            ...sch,
            periods: renumberPeriods(periods),
          }
        })

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "EDIT_PERIOD": {
      const { setupId, scheduleId, periodIndex, periodData, cascadeMode = "shift", shiftEntireDay = false } =
        action.payload

      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const nextSchedules = setup.schedules.map((sch) => {
          if (sch.id !== scheduleId) return sch

          let periods = sch.periods.map((p) => ({ ...p }))
          const current = { ...periods[periodIndex] }
          const oldStart = current.start_time
          const oldEnd = current.end_time
          const oldDur = calculateDuration(oldStart, oldEnd)

          current.type = periodData.type || current.type
          current.is_break = current.type === PERIOD_TYPES.RECESS
          if (periodData.label !== undefined) {
            current.label = periodData.label
            current.hasCustomLabel = Boolean(periodData.hasCustomLabel)
          }
          current.start_time = periodData.start_time || current.start_time
          current.end_time = periodData.end_time || current.end_time

          periods[periodIndex] = current

          const startDelta = parseTime(current.start_time).totalMinutes - parseTime(oldStart).totalMinutes
          const endDelta = parseTime(current.end_time).totalMinutes - parseTime(oldEnd).totalMinutes

          if (periodIndex === 0 && shiftEntireDay && startDelta !== 0) {
            // Shift every following period by startDelta
            for (let i = 1; i < periods.length; i++) {
              const p = { ...periods[i] }
              p.start_time = addMinutesToTime(p.start_time, startDelta)
              p.end_time = addMinutesToTime(p.end_time, startDelta)
              periods[i] = p
            }
          } else if (cascadeMode === "shift" && endDelta !== 0) {
            // Shift all downstream periods by endDelta
            let lastEnd = parseTime(current.end_time).totalMinutes
            for (let i = periodIndex + 1; i < periods.length; i++) {
              const p = { ...periods[i] }
              const dur = calculateDuration(p.start_time, p.end_time)
              p.start_time = formatMinutes(lastEnd)
              lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
              p.end_time = formatMinutes(lastEnd)
              periods[i] = p
            }
          } else if (cascadeMode === "fixed_end" && periodIndex + 1 < periods.length) {
            // Squeeze the next period
            const nextP = { ...periods[periodIndex + 1] }
            nextP.start_time = current.end_time
            periods[periodIndex + 1] = nextP
          }

          return {
            ...sch,
            periods: renumberPeriods(periods),
          }
        })

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "DELETE_PERIOD": {
      const { setupId, scheduleId, periodIndex } = action.payload

      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const nextSchedules = setup.schedules.map((sch) => {
          if (sch.id !== scheduleId) return sch
          if (sch.periods.length <= 1) return sch

          const periods = sch.periods.filter((_, idx) => idx !== periodIndex)
          return {
            ...sch,
            periods: renumberPeriods(periods),
          }
        })

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "EDIT_BOUNDARY_TIME": {
      const { setupId, scheduleId, boundaryIndex, newTime, isFirst } = action.payload

      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const nextSchedules = setup.schedules.map((sch) => {
          if (sch.id !== scheduleId) return sch

          let periods = sch.periods.map((p) => ({ ...p }))
          if (isFirst || boundaryIndex === 0) {
            if (periods[0]) {
              const endM = parseTime(periods[0].end_time)?.totalMinutes ?? 0
              let newStartM = parseTime(newTime)?.totalMinutes ?? 0
              // Enforce 5m min and 180m max period duration
              if (endM - newStartM < MIN_PERIOD_DURATION_MINUTES) {
                newStartM = endM - MIN_PERIOD_DURATION_MINUTES
              } else if (endM - newStartM > 180) {
                newStartM = endM - 180
              }
              periods[0] = { ...periods[0], start_time: formatMinutes(Math.max(0, newStartM)) }
            }
          } else {
            const idx = boundaryIndex > 0 ? boundaryIndex - 1 : 0
            if (periods[idx]) {
              const startM = parseTime(periods[idx].start_time)?.totalMinutes ?? 0
              let newEndM = parseTime(newTime)?.totalMinutes ?? 0
              // Enforce 5m min and 180m max period duration
              if (newEndM - startM < MIN_PERIOD_DURATION_MINUTES) {
                newEndM = startM + MIN_PERIOD_DURATION_MINUTES
              } else if (newEndM - startM > 180) {
                newEndM = startM + 180
              }
              const clampedNewTime = formatMinutes(newEndM)
              periods[idx] = { ...periods[idx], end_time: clampedNewTime }

              // Shift all subsequent periods ahead, preserving their durations and moving school end time ahead
              let lastEnd = newEndM
              for (let i = idx + 1; i < periods.length; i++) {
                const p = { ...periods[i] }
                const dur = calculateDuration(p.start_time, p.end_time)
                p.start_time = formatMinutes(lastEnd)
                lastEnd += Math.max(MIN_PERIOD_DURATION_MINUTES, dur)
                p.end_time = formatMinutes(lastEnd)
                periods[i] = p
              }
            }
          }

          return {
            ...sch,
            periods,
          }
        })

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "SPLIT_DAYS": {
      const { setupId, scheduleId, daysToSplit } = action.payload
      if (!daysToSplit || daysToSplit.length === 0) return state

      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const sourceSchedule = setup.schedules.find((s) => s.id === scheduleId)
        if (!sourceSchedule || sourceSchedule.days.length <= daysToSplit.length) return setup

        const remainingDays = sourceSchedule.days.filter((d) => !daysToSplit.includes(d))
        const newSchedId = `sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

        const newSchedule = {
          id: newSchedId,
          days: [...daysToSplit],
          periods: JSON.parse(JSON.stringify(sourceSchedule.periods)).map((p, i) => ({
            ...p,
            id: `p-${Date.now()}-${i}`,
          })),
        }

        const nextSchedules = setup.schedules.map((sch) =>
          sch.id === scheduleId ? { ...sch, days: remainingDays } : sch
        )
        nextSchedules.push(newSchedule)

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "MERGE_DAYS": {
      const { setupId, sourceScheduleId, targetScheduleId } = action.payload

      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup

        const sourceSchedule = setup.schedules.find((s) => s.id === sourceScheduleId)
        const targetSchedule = setup.schedules.find((s) => s.id === targetScheduleId)
        if (!sourceSchedule || !targetSchedule) return setup

        const mergedDays = [...new Set([...targetSchedule.days, ...sourceSchedule.days])]

        const nextSchedules = setup.schedules
          .filter((s) => s.id !== sourceScheduleId)
          .map((s) => (s.id === targetScheduleId ? { ...s, days: mergedDays } : s))

        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "MOVE_CLASSES": {
      const { sectionIds, targetSetupId } = action.payload
      const nextAssignments = { ...state.sectionAssignments }
      sectionIds.forEach((secId) => {
        nextAssignments[secId] = targetSetupId
      })

      return pushHistory({
        ...state,
        sectionAssignments: nextAssignments,
      })
    }

    case "APPLY_TEMPLATE": {
      const { setupId, scheduleId, templateType = "standard" } = action.payload
      const nextSetups = state.setups.map((setup) => {
        if (setup.id !== setupId) return setup
        const nextSchedules = setup.schedules.map((sch) => {
          if (sch.id !== scheduleId) return sch
          return {
            ...sch,
            periods: createDefaultPeriodsTemplate(),
          }
        })
        return { ...setup, schedules: nextSchedules }
      })

      return pushHistory({
        ...state,
        setups: nextSetups,
      })
    }

    case "DISCARD_CHANGES": {
      return {
        ...state,
        isDirty: false,
      }
    }

    case "SAVE_SUCCESS": {
      const { savedSetups = [], revision } = action.payload || {}
      const savedMap = new Map()
      savedSetups.forEach((ss, idx) => {
        if (ss.id) savedMap.set(String(ss.id), ss)
        savedMap.set(`idx_${idx}`, ss)
      })

      // ID mapping in case temporary setup IDs were replaced by server UUIDs
      const idMap = {}
      const nextSetups = state.setups.map((setup, idx) => {
        const matched = savedMap.get(String(setup.id)) || savedMap.get(`idx_${idx}`)
        if (!matched) return setup
        if (setup.id !== matched.id) {
          idMap[setup.id] = matched.id
        }
        return {
          ...setup,
          id: matched.id,
          version: matched.version ?? setup.version,
        }
      })

      let nextAssignments = state.sectionAssignments
      let nextActiveSetupId = state.activeSetupId
      if (Object.keys(idMap).length > 0) {
        nextAssignments = {}
        Object.entries(state.sectionAssignments).forEach(([secId, sId]) => {
          nextAssignments[secId] = idMap[sId] || sId
        })
        if (idMap[nextActiveSetupId]) {
          nextActiveSetupId = idMap[nextActiveSetupId]
        }
      }

      // If no new actions were dispatched while the save was in flight, mark clean
      const isStillDirty = revision !== undefined ? state.revision !== revision : false

      return {
        ...state,
        setups: nextSetups,
        sectionAssignments: nextAssignments,
        activeSetupId: nextActiveSetupId,
        isDirty: isStillDirty,
      }
    }

    case "SYNC_SERVER_SETUPS": {
      const { setups, sectionAssignments } = action.payload
      return {
        ...state,
        setups,
        sectionAssignments: sectionAssignments || state.sectionAssignments,
        isDirty: false,
        revision: (state.revision || 0) + 1,
        history: { past: [], future: [] },
      }
    }

    default:
      return state
  }
}

