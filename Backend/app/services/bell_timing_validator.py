"""
Bell Timing Validation Rules (Backend)
Mirrors frontend validators to guarantee invariant enforcement.
"""
from typing import List, Dict, Any, Tuple


MIN_PERIOD_DURATION_MINUTES = 15
MAX_PERIOD_DURATION_MINUTES = 180
MAX_PERIODS_PER_SCHEDULE = 20

ALL_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]


def parse_time_to_minutes(time_str: str) -> int:
    """Parses 'HH:MM' string to minutes from midnight."""
    if not time_str or ":" not in time_str:
        raise ValueError(f"Invalid time string: '{time_str}'")
    parts = time_str.strip().split(":")
    h = int(parts[0])
    m = int(parts[1])
    if h < 0 or h > 23 or m < 0 or m > 59:
        raise ValueError(f"Time out of 24-hour range: '{time_str}'")
    return h * 60 + m


def validate_period_sequence(periods: List[Dict[str, Any]], schedule_name: str = "Schedule") -> Tuple[List[str], List[str]]:
    """
    Validates a list of period dictionaries for a single schedule.
    Returns (errors, warnings).
    """
    errors = []
    warnings = []

    if not periods:
        errors.append(f"{schedule_name}: Schedule must have at least one period.")
        return errors, warnings

    if len(periods) > MAX_PERIODS_PER_SCHEDULE:
        errors.append(f"{schedule_name}: Schedule cannot exceed {MAX_PERIODS_PER_SCHEDULE} periods.")

    has_class_period = False
    seen_labels = set()

    for idx, p in enumerate(periods):
        p_num = p.get("period_number", idx + 1)
        p_type = p.get("type") or ("RECESS" if p.get("is_break") else "CLASS")
        if p_type == "CLASS":
            has_class_period = True

        label = (p.get("label") or f"Period {p_num}").strip()
        if label.lower() in seen_labels:
            errors.append(f"{schedule_name}: Duplicate period label '{label}' found.")
        seen_labels.add(label.lower())

        st_str = p.get("start_time", "")
        et_str = p.get("end_time", "")

        try:
            st = parse_time_to_minutes(st_str)
            et = parse_time_to_minutes(et_str)
        except ValueError as ve:
            errors.append(f"{schedule_name} period '{label}': {str(ve)}")
            continue

        if st >= et:
            errors.append(f"{schedule_name} period '{label}': End time ({et_str}) must be after start time ({st_str}).")
            continue

        dur = et - st
        if dur < MIN_PERIOD_DURATION_MINUTES:
            errors.append(f"{schedule_name} period '{label}': Duration ({dur}m) is less than minimum {MIN_PERIOD_DURATION_MINUTES} minutes.")
        if dur > MAX_PERIOD_DURATION_MINUTES:
            errors.append(f"{schedule_name} period '{label}': Duration ({dur}m) exceeds maximum {MAX_PERIOD_DURATION_MINUTES} minutes.")

        # Overlap and gap check with next period
        if idx < len(periods) - 1:
            next_p = periods[idx + 1]
            next_st_str = next_p.get("start_time", "")
            try:
                next_st = parse_time_to_minutes(next_st_str)
                next_label = next_p.get("label") or f"Period {idx + 2}"
                if et > next_st:
                    errors.append(
                        f"{schedule_name}: Period '{label}' ({st_str}-{et_str}) overlaps with '{next_label}' ({next_st_str}-{next_p.get('end_time')})."
                    )
                elif next_st > et:
                    gap = next_st - et
                    warnings.append(
                        f"{schedule_name}: Gap of {gap}m between '{label}' ({et_str}) and '{next_label}' ({next_st_str})."
                    )
            except ValueError:
                pass

    if not has_class_period:
        errors.append(f"{schedule_name}: Must have at least 1 Class period.")

    return errors, warnings


def validate_setup_day_invariants(setup_data: Dict[str, Any], working_days: List[str] = None) -> List[str]:
    """
    Ensures every working day belongs to exactly one schedule in the setup.
    """
    if working_days is None:
        working_days = ALL_WEEKDAYS

    errors = []
    setup_name = setup_data.get("name") or "Setup"
    schedules = setup_data.get("schedules") or []

    if not schedules:
        errors.append(f"Setup '{setup_name}' must have at least one schedule.")
        return errors

    day_counts = {d.upper(): 0 for d in working_days}

    for idx, sch in enumerate(schedules):
        days = sch.get("days") or []
        if not days:
            errors.append(f"Setup '{setup_name}' schedule {idx + 1} has no days assigned.")
        for d in days:
            d_upper = d.upper()
            if d_upper in day_counts:
                day_counts[d_upper] += 1

    for day, count in day_counts.items():
        if count == 0:
            errors.append(f"Setup '{setup_name}': Day '{day}' is not assigned to any schedule.")
        elif count > 1:
            errors.append(f"Setup '{setup_name}': Day '{day}' is assigned to multiple schedules.")

    return errors

