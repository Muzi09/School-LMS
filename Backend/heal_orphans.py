import sys
import os
import json
from datetime import datetime, timezone
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from app.core.database import SessionLocal
from app.models.timetable import TimetablePeriod, TimetableEntry, TimetableSetup

def heal_timetable_data():
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    healed_entries_count = 0
    deleted_entries_count = 0

    try:
        # 1. Heal orphaned entries pointing to soft-deleted periods
        orphaned_entries = (
            db.query(TimetableEntry, TimetablePeriod)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .filter(
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.isnot(None),
            )
            .all()
        )

        print(f"Found {len(orphaned_entries)} orphaned entries.")

        for entry, old_period in orphaned_entries:
            day_upper = (entry.day_of_week or "").upper()
            candidates = (
                db.query(TimetablePeriod)
                .filter(
                    TimetablePeriod.setup_id == old_period.setup_id,
                    TimetablePeriod.period_number == old_period.period_number,
                    TimetablePeriod.deleted_at.is_(None),
                )
                .all()
            )

            best_candidate = None
            for cand in candidates:
                cand_sch = (cand.schedule_id or "").lower()
                if day_upper == "SATURDAY" and "saturday" in cand_sch:
                    best_candidate = cand
                    break
                elif day_upper != "SATURDAY" and "saturday" not in cand_sch:
                    best_candidate = cand
                    break

            if not best_candidate and candidates:
                best_candidate = candidates[0]

            if best_candidate:
                print(f"Re-linking entry {entry.id} (day {day_upper}, period {old_period.period_number}) from old period {old_period.id} -> new active period {best_candidate.id} (sch: {best_candidate.schedule_id})")
                entry.period_id = best_candidate.id
                entry.updated_at = now
                healed_entries_count += 1
            else:
                print(f"No active period found for entry {entry.id} (period {old_period.period_number}). Soft-deleting entry.")
                entry.deleted_at = now
                deleted_entries_count += 1

        # 2. Heal schedules_json in setups if any period IDs are out of date
        setups = db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None)).all()
        for s in setups:
            if not s.schedules_json:
                continue
            try:
                schedules = json.loads(s.schedules_json)
                periods = (
                    db.query(TimetablePeriod)
                    .filter(TimetablePeriod.setup_id == s.id, TimetablePeriod.deleted_at.is_(None))
                    .all()
                )
                active_p_ids = {str(p.id) for p in periods}
                periods_by_sch_num = {(p.schedule_id or "default", p.period_number): p for p in periods}
                periods_by_num = {p.period_number: p for p in periods}
                modified = False

                for sch in schedules:
                    sch_id = sch.get("id") or "default"
                    for p_item in sch.get("periods", []):
                        raw_id = p_item.get("id")
                        if not raw_id or str(raw_id) not in active_p_ids:
                            p_num = p_item.get("period_number")
                            matched_p = periods_by_sch_num.get((sch_id, p_num)) or periods_by_num.get(p_num)
                            if matched_p:
                                p_item["id"] = str(matched_p.id)
                                modified = True

                if modified:
                    print(f"Updated schedules_json for setup {s.id} ({s.name})")
                    s.schedules_json = json.dumps(schedules)
            except Exception as ex:
                print(f"Error parsing schedules_json for setup {s.id}: {ex}")

        db.commit()
        print(f"Healing complete! Re-linked {healed_entries_count} entries, soft-deleted {deleted_entries_count} invalid entries.")

    except Exception as e:
        db.rollback()
        print(f"Failed to heal timetable: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    heal_timetable_data()

