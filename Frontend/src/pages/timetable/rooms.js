// Values here are already resolved by the school API for each section and subject.
export function describeRooms(rooms) {
  const values = new Set(rooms.map(item => item.room || ""))
  if (values.size <= 1) return rooms[0]?.room || "Not assigned"
  return rooms.map(item => item.section + " · " + (item.room || "Not assigned")).join(" / ")
}

export function classLessonRoomLabel(entry, section) {
  const room = entry.room_number?.trim()
  return room && room !== section?.room_number?.trim() ? "Room " + room : null
}

export function lessonRoomLabel(entry) {
  const rooms = entry.sectionRooms
  if (rooms?.length > 1 && new Set(rooms.map(item => item.room || "")).size > 1) return describeRooms(rooms)
  return entry.room_number ? "Room " + entry.room_number : "Not assigned"
}

export function optionRoomLabel(index, option) {
  return describeRooms(option.section_ids.map(id => {
    const allocation = index.rooms.get(id + "/" + option.subject_id)
    return {
      section: index.sections.get(id),
      room: allocation?.room_review ? option.sectionRooms?.[id] ?? allocation.room_number : allocation?.room_number,
    }
  }))
}
