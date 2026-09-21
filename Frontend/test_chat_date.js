import assert from "node:assert/strict"
import { formatLastSeen } from "./src/lib/chatDate.js"

console.log("Starting chatDate test suite...")

// 1. Never-seen users / invalid input
assert.equal(formatLastSeen(null), "", "null dateString should return empty string")
assert.equal(formatLastSeen(undefined), "", "undefined dateString should return empty string")
assert.equal(formatLastSeen(""), "", "empty dateString should return empty string")
assert.equal(formatLastSeen("invalid-date-string"), "", "invalid date should return empty string")
assert.equal(formatLastSeen(new Date(NaN)), "", "invalid Date object should return empty string")
console.log("[PASS] Never-seen users and invalid date strings return empty string")

// Set a base reference time for tests:
// Friday, 25 Sep 2026, 15:30:00 local time
const baseNow = new Date(2026, 8, 25, 15, 30, 0) // Month index 8 = September

// 2. Minute formatting (< 1 hour)
// 30 seconds ago -> 1 minute ago (avoid 0 minutes ago)
const sec30Ago = new Date(baseNow.getTime() - 30 * 1000)
assert.equal(formatLastSeen(sec30Ago.toISOString(), baseNow), "Last seen 1 minute ago")

// 1 minute ago
const min1Ago = new Date(baseNow.getTime() - 60 * 1000)
assert.equal(formatLastSeen(min1Ago.toISOString(), baseNow), "Last seen 1 minute ago")

// 15 minutes ago
const min15Ago = new Date(baseNow.getTime() - 15 * 60 * 1000)
assert.equal(formatLastSeen(min15Ago.toISOString(), baseNow), "Last seen 15 minutes ago")

// 59 minutes ago
const min59Ago = new Date(baseNow.getTime() - 59 * 60 * 1000)
assert.equal(formatLastSeen(min59Ago.toISOString(), baseNow), "Last seen 59 minutes ago")
console.log("[PASS] Minute formatting and singular/plural verified (< 1 hour)")

// 3. Hour formatting (1 to 23 hours)
// 1 hour ago (singular)
const hr1Ago = new Date(baseNow.getTime() - 60 * 60 * 1000)
assert.equal(formatLastSeen(hr1Ago.toISOString(), baseNow), "Last seen 1 hour ago")

// 7 hours ago (plural)
const hr7Ago = new Date(baseNow.getTime() - 7 * 60 * 60 * 1000)
assert.equal(formatLastSeen(hr7Ago.toISOString(), baseNow), "Last seen 7 hours ago")

// 23 hours ago (plural)
const hr23Ago = new Date(baseNow.getTime() - 23 * 60 * 60 * 1000)
assert.equal(formatLastSeen(hr23Ago.toISOString(), baseNow), "Last seen 23 hours ago")
console.log("[PASS] Hour formatting and singular/plural verified (1 to 23 hours)")

// 4. Previous calendar day (>= 24 hours ago, on yesterday)
// Base now is Friday 15:30. Yesterday is Thursday.
// 25 hours ago is Thursday 14:24 (yesterday 02:24 PM)
const yesterday224PM = new Date(2026, 8, 24, 14, 24, 0)
assert.equal(
  formatLastSeen(yesterday224PM.toISOString(), baseNow),
  "Last seen yesterday 02:24 PM"
)
console.log("[PASS] Yesterday formatting matches 'Last seen yesterday 02:24 PM'")

// 5. Within current week:
// Base now: Friday, 25 Sep 2026 (week started Monday 21 Sep 2026)
// Tuesday of the current week: 22 Sep 2026, 10:00 AM
const tuesdayCurrentWeek = new Date(2026, 8, 22, 10, 0, 0)
assert.equal(
  formatLastSeen(tuesdayCurrentWeek.toISOString(), baseNow),
  "Last seen on Tuesday"
)

// Monday of the current week: 21 Sep 2026
const mondayCurrentWeek = new Date(2026, 8, 21, 9, 0, 0)
assert.equal(
  formatLastSeen(mondayCurrentWeek.toISOString(), baseNow),
  "Last seen on Monday"
)
console.log("[PASS] Current-week weekday formatting matches 'Last seen on Tuesday'")

// 6. Older than the current week:
// Example from prompt: 02 Aug 2023, 05:23 PM
const olderDate = new Date(2023, 7, 2, 17, 23, 0) // August = month index 7
assert.equal(
  formatLastSeen(olderDate.toISOString(), baseNow),
  "Last seen on 02 Aug 2023, 05:23 PM"
)

// Previous week (e.g. Sunday 20 Sep 2026, 14:15 PM)
const sundayLastWeek = new Date(2026, 8, 20, 14, 15, 0)
assert.equal(
  formatLastSeen(sundayLastWeek.toISOString(), baseNow),
  "Last seen on 20 Sep 2026, 02:15 PM"
)
console.log("[PASS] Older-date formatting matches 'Last seen on 02 Aug 2023, 05:23 PM'")

console.log("\n==========================================")
console.log("ALL FRONTEND LAST SEEN FORMATTING TESTS PASSED!")
console.log("==========================================\n")
