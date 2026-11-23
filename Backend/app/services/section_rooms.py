"""Room resolution for an allocated subject and its scheduled lessons."""


def effective_room(section, subject_id, overrides, legacy=None):
    if not section:
        return None
    default = (section.room_number or "").strip() or None
    if getattr(section, "single_room", False):
        return default
    if legacy and str(subject_id) in (section.room_reviews or {}):
        return legacy.strip() or default
    return (overrides.get((section.id, subject_id)) or "").strip() or default
