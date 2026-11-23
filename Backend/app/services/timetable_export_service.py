import io
import re
from collections import defaultdict
from dataclasses import dataclass
from itertools import groupby, zip_longest
from textwrap import wrap
from typing import Dict
from uuid import UUID

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.models.school import School
from app.models.school_class import SchoolClass
from app.services.school_order import class_order, section_order
from app.models.section import Section
from app.models.timetable import DayOfWeek
from app.services.timetable_service import TimetableService


# ---------------------------------------------------------------------------
# Subject Color Palette (ARGB Hex codes)
# Soft pastel fills with high contrast readable text
# ---------------------------------------------------------------------------
SUBJECT_PALETTE_HEX = {
    "blue": {"fill": "FFDBEAFE", "text": "FF1E40AF"},      # Math
    "emerald": {"fill": "FFD1FAE5", "text": "FF065F46"},   # English
    "amber": {"fill": "FFFEF3C7", "text": "FF92400E"},     # Science / EVS
    "violet": {"fill": "FFEDE9FE", "text": "FF5B21B6"},    # Social / Hindi / Languages
    "rose": {"fill": "FFFFE4E6", "text": "FF9F1239"},      # Sports / PE
    "fuchsia": {"fill": "FFFCE7F3", "text": "FF86198F"},   # Arts / Craft
    "teal": {"fill": "FFCCFBF1", "text": "FF115E59"},      # Music / Dance
    "sky": {"fill": "FFE0F2FE", "text": "FF075985"},       # Computer / IT / Robotics
    "indigo": {"fill": "FFE0E7FF", "text": "FF3730A3"},    # Commerce / Economics
    "break": {"fill": "FFF1F5F9", "text": "FF475569"},     # Recess / Lunch / Assembly
    "neutral": {"fill": "FFF8FAFC", "text": "FF334155"},   # Default / Fallback
}


def get_subject_hex_color(subject_name: str = "", category: str = "") -> Dict[str, str]:
    """Returns pastel background fill and text ARGB hex matching frontend palette."""
    if not subject_name:
        return SUBJECT_PALETTE_HEX["neutral"]

    name = subject_name.lower().strip()

    if any(k in name for k in ["math", "calc", "algebra", "geom", "arith"]):
        return SUBJECT_PALETTE_HEX["blue"]
    if any(k in name for k in ["eng", "lit", "gram"]):
        return SUBJECT_PALETTE_HEX["emerald"]
    if any(k in name for k in ["sci", "phy", "chem", "bio", "evs"]):
        return SUBJECT_PALETTE_HEX["amber"]
    if any(k in name for k in ["hin", "soc", "his", "geo", "civ", "sanskrit", "french", "urdu", "lang"]):
        return SUBJECT_PALETTE_HEX["violet"]
    if any(k in name for k in ["sport", "pe", "play", "games", "swim", "pt", "yoga"]):
        return SUBJECT_PALETTE_HEX["rose"]
    if any(k in name for k in ["art", "craft", "draw", "paint"]):
        return SUBJECT_PALETTE_HEX["fuchsia"]
    if any(k in name for k in ["music", "dance", "rhyme", "band"]):
        return SUBJECT_PALETTE_HEX["teal"]
    if any(k in name for k in ["comp", "it", "code", "ai", "robot", "cyber"]):
        return SUBJECT_PALETTE_HEX["sky"]
    if any(k in name for k in ["eco", "comm", "acc", "bus"]):
        return SUBJECT_PALETTE_HEX["indigo"]

    # Category fallback
    cat = (category or "").lower().strip()
    if "acad" in cat:
        return SUBJECT_PALETTE_HEX["blue"]
    if "activ" in cat:
        return SUBJECT_PALETTE_HEX["teal"]

    # Deterministic hash fallback for unknown subjects
    keys = ["blue", "emerald", "amber", "violet", "rose", "fuchsia", "teal", "sky", "indigo"]
    hash_val = sum(ord(c) for c in subject_name)
    selected_key = keys[hash_val % len(keys)]
    return SUBJECT_PALETTE_HEX[selected_key]


# Borders
THIN_GRAY_SIDE = Side(border_style="thin", color="FFCBD5E1")
MEDIUM_DARK_SIDE = Side(border_style="medium", color="FF64748B")

BORDER_BOX = Border(
    left=THIN_GRAY_SIDE,
    right=THIN_GRAY_SIDE,
    top=THIN_GRAY_SIDE,
    bottom=THIN_GRAY_SIDE,
)

BORDER_HEADER = Border(
    left=THIN_GRAY_SIDE,
    right=THIN_GRAY_SIDE,
    top=MEDIUM_DARK_SIDE,
    bottom=MEDIUM_DARK_SIDE,
)

FILL_TITLE = PatternFill(fill_type="solid", start_color="FF1E293B", end_color="FF1E293B")
FONT_TITLE = Font(name="Segoe UI", size=13, bold=True, color="FFFFFFFF")

FILL_HEADER = PatternFill(fill_type="solid", start_color="FFE2E8F0", end_color="FFE2E8F0")
FONT_HEADER = Font(name="Segoe UI", size=9, bold=True, color="FF1E293B")

ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _teaching(p):
    return (not p.get("is_break") and p.get("period_type", "CLASS") == "CLASS"
            and not re.match(r"^(?:recess|break|assembly|activity|extra-?curricular|[RAE]\d*$)", p.get("label") or "", re.I))


def _times(period):
    return period["start_time"][:5], period["end_time"][:5]


def _section_name(section):
    return f"{section['class_name']} {section['name']}".strip()


def _minutes(value):
    return int(value[:2]) * 60 + int(value[3:5])


def _clock(minutes):
    return f"{minutes // 60:02}:{minutes % 60:02}"


def _free_intervals(shifts, busy):
    hours = []
    for start, end in sorted((_minutes(s["start_time"]), _minutes(s["end_time"]))
                             for s in shifts if s.get("start_time") and s.get("end_time")):
        if start >= end:
            continue
        if hours and start <= hours[-1][1]:
            hours[-1][1] = max(hours[-1][1], end)
        else:
            hours.append([start, end])
    for start, end in hours:
        cursor = start
        for begin, finish in busy:
            if finish <= cursor or begin >= end:
                continue
            if begin > cursor:
                yield cursor, begin
            cursor = max(cursor, finish)
        if cursor < end:
            yield cursor, end


@dataclass(frozen=True)
class ExportCell:
    text: str
    subject: str = ""

    def chunks(self, width=27, max_lines=24):
        # Excel caps row height at 409 points. Continue very large rosters on the next row.
        lines = self.text.split("\n")
        if sum(max(1, (len(line) + width - 1) // width) for line in lines) <= max_lines:
            return [self]
        wrapped = [part for line in lines for part in (wrap(line, width=width) or [""])]
        return [ExportCell("\n".join(wrapped[i:i + max_lines]), self.subject)
                for i in range(0, len(wrapped), max_lines)]


class ScheduleSheet:
    def __init__(self, workbook, name, title, color):
        self.sheet = workbook.create_sheet(name)
        self.next_row = 1
        self.color = color
        self.banner(title, 4)
        self.sheet.sheet_properties.pageSetUpPr.fitToPage = True
        self.sheet.page_setup.orientation = "landscape"
        self.sheet.page_setup.fitToWidth = 1
        self.sheet.page_setup.fitToHeight = 0

    def write(self, values, kind="data"):
        row = self.next_row
        self.next_row += 1
        height = 25
        for col, value in enumerate(values, 1):
            item = value if isinstance(value, ExportCell) else ExportCell(value)
            cell = self.sheet.cell(row, col)
            cell.value = item.text
            cell.data_type = "s"  # Preserve literal names and room labels, including leading equals signs.
            cell.alignment = ALIGN_CENTER
            cell.border = BORDER_HEADER if kind == "header" else BORDER_BOX
            width = 16 if col == 1 else 28
            self.sheet.column_dimensions[get_column_letter(col)].width = width
            lines = sum(max(1, (len(line) + width - 2) // (width - 1)) for line in item.text.split("\n"))
            height = max(height, 15 * lines + 5)
            if kind == "title":
                cell.font, cell.fill = FONT_TITLE, FILL_TITLE
                cell.alignment = Alignment(vertical="center")
            elif kind == "header":
                cell.font, cell.fill = FONT_HEADER, FILL_HEADER
            elif item.subject and self.color:
                theme = get_subject_hex_color(item.subject)
                cell.font = Font(name="Segoe UI", size=10, color=theme["text"])
                cell.fill = PatternFill("solid", fgColor=theme["fill"])
        self.sheet.row_dimensions[row].height = min(height, 409)
        return row

    def banner(self, text, columns):
        row = self.write([text], "title")
        self.sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=max(3, columns))
        self.sheet.row_dimensions[row].height = 28

    def grid(self, daily):
        for headers, group in groupby(daily, key=lambda row: row[1]):
            self.write(["Day", *headers], "header")
            for day, _, cells in group:
                parts = [cell.chunks() for cell in cells] or [[ExportCell("")]]
                for index, row in enumerate(zip_longest(*parts, fillvalue=ExportCell(""))):
                    self.write([day.title() if index == 0 else f"{day.title()} (cont.)", *row])

    def review(self, entries):
        if entries:
            self.write(["Review", "Outside the current bell schedule"], "header")
        for e in entries:
            self.write([e["day_of_week"].title(), "–".join(_times(e["period"])), _section_name(e["section"]),
                        e["subject"]["name"], e.get("room_number") or ""])


class TimetableExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_timetable_excel(self, school_id: UUID, timetable_id=None, scope="both", wing_ids=None,
                               class_ids=None, section_ids=None, teacher_ids=None, color_coded=True):
        data = TimetableService(self.db).get_class_wise_timetable(
            school_id, timetable_id=timetable_id, include_timetable_list=False
        )
        timetable = data["timetable"]
        school_name = self.db.query(School.name).filter_by(id=school_id).scalar()
        title = " · ".join(filter(None, [school_name, timetable["name"], timetable["academic_year"]]))
        workbook = openpyxl.Workbook()
        workbook.remove(workbook.active)
        days = [d.value for d in DayOfWeek]
        section_bells = {}
        for setup in data["setups"]:
            schedule = {day: sorted(s["periods"], key=_times) for s in setup["schedules"] for day in s["days"]
                        if not setup["applicable_days"] or day in setup["applicable_days"]}
            for sid in setup["assigned_section_ids"]:
                section_bells[sid] = schedule

        by_section, by_teacher = defaultdict(list), defaultdict(list)
        teacher_sections = defaultdict(set)
        selected = {}
        visible_wings = set(wing_ids) if wing_ids is not None else None
        for wing in data["wings"]:
            for cls in wing["classes"]:
                for sec in cls["sections"]:
                    if visible_wings is None or wing["id"] in visible_wings:
                        selected[sec["id"]] = sec
                    for stat in sec["subject_stats"]:
                        if stat["teacher_id"]:
                            teacher_sections[stat["teacher_id"]].add(sec["id"])

        # Schools can configure timetables before assigning their classes to wings.
        if scope != "teacherwise" and wing_ids is None:
            for sid, name, cid, cname in self.db.query(Section.id, Section.name, SchoolClass.id, SchoolClass.name).join(
                    SchoolClass, SchoolClass.id == Section.class_id).filter(
                    Section.school_id == school_id, Section.deleted_at.is_(None),
                    SchoolClass.school_id == school_id, SchoolClass.deleted_at.is_(None)).order_by(
                    *class_order(), *section_order()):
                selected.setdefault(sid, {"id": sid, "name": name, "class_id": cid, "class_name": cname})

        active_options = defaultdict(set)
        for entry in data["entries"]:
            if entry["placement_id"]:
                active_options[str(entry["placement_id"])].add(entry["option_id"])
            by_section[entry["section_id"]].append(entry)
            tid = entry["teacher_user_id"]
            if tid:
                by_teacher[tid].append(entry)
                teacher_sections[tid].add(entry["section_id"])

        placements = data["lecture_plan"].get("placements", {})
        coverage = {}
        for pid, options in active_options.items():
            expected = len(placements.get(pid, {}).get("expected", []))
            if len(options) < expected:
                coverage[pid] = f"{len(options)} of {expected} options scheduled"
        if scope in ("classwise", "both"):
            sheet = ScheduleSheet(workbook, "Class-wise Timetable", title, color_coded)
            classes = set(class_ids) if class_ids is not None else None
            sections = set(section_ids) if section_ids is not None else None
            for sid, section in selected.items():
                if classes is not None and section["class_id"] not in classes:
                    continue
                if sections is None or sid in sections:
                    self._class_card(sheet, section, by_section[sid], section_bells.get(sid, {}), days, placements)
        if scope in ("teacherwise", "both"):
            sheet = ScheduleSheet(workbook, "Teacher-wise Timetable", title, color_coded)
            teachers = set(teacher_ids) if teacher_ids is not None else None
            for teacher in data["eligible_teachers"]:
                tid = teacher["id"]
                if teachers is None or tid in teachers:
                    self._teacher_card(sheet, teacher, by_teacher[tid], teacher_sections[tid], section_bells, days, coverage)
        stream = io.BytesIO()
        workbook.save(stream)
        stream.seek(0)
        return stream

    @staticmethod
    def _class_card(sheet, section, entries, schedule, days, placements):
        sid = section["id"]
        slots = defaultdict(list)
        for entry in entries:
            slots[entry["day_of_week"], str(entry["period_id"])].append(entry)
        daily = []
        for day in days:
            periods = schedule.get(day, [])
            if not periods:
                continue
            headers, cells = [], []
            for p in periods:
                headers.append((p.get("label") or f"P{p['period_number']}") + "\n" + "–".join(_times(p)))
                lessons = slots.pop((day, str(p["id"])), [])
                lines = []
                for e in lessons:
                    name = (e["teacher"] or {}).get("name") or "Unassigned teacher"
                    lines.append(" · ".join(filter(None, [e["subject"]["name"], name, e.get("room_number")])))
                if lessons:
                    expected = placements.get(str(lessons[0]["placement_id"]), {}).get("expected", [])
                    total = sum(str(sid) in row["section_ids"] for row in expected)
                    if len(lessons) < total:
                        lines.append(f"{len(lessons)} of {total} options scheduled")
                cells.append(ExportCell("\n".join(lines) or ("—" if _teaching(p) else p.get("label") or "Break"),
                                        lessons[0]["subject"]["name"] if lessons else ""))
            daily.append((day, headers, cells))
        sheet.banner(_section_name(section), max((len(cells) + 1 for _, _, cells in daily), default=3))
        sheet.grid(daily)
        if not daily:
            sheet.write(["No bell schedule assigned."])
        sheet.review([e for bucket in slots.values() for e in bucket])

    @staticmethod
    def _teacher_card(sheet, teacher, entries, section_ids, section_bells, days, coverage):
        schedules = [section_bells[s] for s in section_ids if s in section_bells]
        allowed = {sid: {(day, str(p["id"])) for day, periods in section_bells.get(sid, {}).items()
                         for p in periods if _teaching(p)} for sid in section_ids}
        lessons, review = defaultdict(dict), []
        for e in entries:
            day = e["day_of_week"]
            if (day, str(e["period_id"])) not in allowed[e["section_id"]]:
                review.append(e)
                continue
            start, end = _times(e["period"])
            identity = e["placement_id"] or e["id"]
            lessons[day].setdefault((start, end, identity), []).append(e)

        daily = []
        minutes = free_minutes = 0
        shifts = teacher.get("working_shifts") or []
        for day in days:
            bells = [schedule[day] for schedule in schedules if schedule.get(day)]
            if not bells:
                continue
            by_time = defaultdict(list)
            segments = []
            for (start, end, _), group in lessons[day].items():
                e = group[0]
                label = " + ".join(_section_name(row["section"]) for row in group)
                period_labels = " / ".join(dict.fromkeys(f"P{row['period']['period_number']}" for row in group))
                elapsed = _minutes(end) - _minutes(start)
                minutes += elapsed
                rooms = {row.get("room_number") for row in group}
                room = (e.get("room_number") or "Not assigned") if len(rooms) == 1 else " / ".join(
                    f"{_section_name(row['section'])} · {row.get('room_number') or 'Not assigned'}" for row in group
                )
                description = " · ".join([e["subject"]["name"], label, room])
                if len({row["subject"]["id"] for row in group}) > 1:
                    description = "\n".join(
                        f"{row['subject']['name']} · {_section_name(row['section'])} · {row.get('room_number') or 'Not assigned'}"
                        for row in group
                    )
                if str(e["placement_id"]) in coverage:
                    description += "\n" + coverage[str(e["placement_id"])]
                by_time[start, end].append(ExportCell(description, e["subject"]["name"]))
                segments.append((start, ExportCell(f"{start}–{end}\n{period_labels} · {elapsed}m\n{description}", e["subject"]["name"])))
            busy = sorted((_minutes(start), _minutes(end)) for start, end in by_time)
            for num, (start, end) in enumerate(_free_intervals(shifts, busy), 1):
                free_minutes += end - start
                segments.append((_clock(start), ExportCell(f"{_clock(start)}–{_clock(end)}\nF{num} · {end-start}m free")))

            signatures = {tuple((_times(p), _teaching(p)) for p in periods) for periods in bells}
            if len(signatures) == 1:
                headers, cells = [], []
                for i, p in enumerate(bells[0]):
                    start, end = _times(p)
                    labels = sorted({b[i]["period_number"] for b in bells})
                    label = " / ".join(f"P{n}" for n in labels) if len(labels) > 1 else p.get("label") or f"P{p['period_number']}"
                    headers.append(f"{label}\n{start}–{end}")
                    matches = by_time[start, end]
                    cells.append(ExportCell("\n".join(c.text for c in matches), matches[0].subject) if matches else
                                 ExportCell("Free" if _teaching(p) else label))
            else:
                cells = [item for _, item in sorted(segments, key=lambda item: item[0])]
                if not shifts:
                    cells.append(ExportCell("Working hours unavailable"))
                headers = ["Timeline"] + [""] * max(0, len(cells) - 1)
            daily.append((day, headers, cells))
        count = sum(len(items) for items in lessons.values())
        summary = f"{teacher['name']} · Assigned {count} · {minutes}m teaching"
        if shifts:
            summary += f" · {free_minutes}m free"
        sheet.banner(summary, max((len(cells) + 1 for _, _, cells in daily), default=3))
        sheet.grid(daily)
        if not daily:
            sheet.write(["No class bell schedule assigned."])
        sheet.review(review)
