import io
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.subject import Subject
from app.models.timetable import (
    DayOfWeek,
    Timetable,
    TimetableEntry,
    TimetablePeriod,
    TimetableSetup,
)
from app.models.staff import StaffProfile
from app.models.user import User, UserRole
from app.models.wing import Wing, WingClass


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
DOUBLE_DARK_SIDE = Side(border_style="double", color="FF475569")

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

FILL_SUBTITLE = PatternFill(fill_type="solid", start_color="FFF8FAFC", end_color="FFF8FAFC")
FONT_SUBTITLE = Font(name="Segoe UI", size=9, bold=False, color="FF64748B")

FILL_HEADER = PatternFill(fill_type="solid", start_color="FFE2E8F0", end_color="FFE2E8F0")
FONT_HEADER = Font(name="Segoe UI", size=9, bold=True, color="FF1E293B")

FILL_DAY = PatternFill(fill_type="solid", start_color="FFF1F5F9", end_color="FFF1F5F9")
FONT_DAY = Font(name="Segoe UI", size=9, bold=True, color="FF334155")

ALIGN_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=False)


def _format_time_12h(time_obj) -> str:
    """Formats time object or string to 12h representation e.g. 8:50 AM."""
    if not time_obj:
        return ""
    if hasattr(time_obj, "strftime"):
        # e.g. 8:50 AM
        return time_obj.strftime("%I:%M %p").lstrip("0")
    s = str(time_obj).strip()
    if ":" in s:
        parts = s.split(":")
        try:
            h = int(parts[0])
            m = int(parts[1])
            period = "PM" if h >= 12 else "AM"
            h12 = 12 if h in (0, 12) else h % 12
            return f"{h12}:{m:02d} {period}"
        except Exception:
            return s
    return s


class TimetableExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_timetable_excel(
        self,
        school_id: UUID,
        timetable_id: Optional[UUID] = None,
        scope: str = "both",  # "classwise" | "teacherwise" | "both"
        wing_ids: Optional[List[UUID]] = None,
        class_ids: Optional[List[UUID]] = None,
        section_ids: Optional[List[UUID]] = None,
        teacher_ids: Optional[List[UUID]] = None,
        color_coded: bool = True,
    ) -> io.BytesIO:
        """
        Master method to export timetable to Excel.
        Produces a beautifully styled workbook with Class-wise and/or Teacher-wise sheets.
        """
        # 1. Fetch Timetable
        if timetable_id:
            timetable = (
                self.db.query(Timetable)
                .filter(Timetable.id == timetable_id, Timetable.school_id == school_id)
                .first()
            )
        else:
            timetable = (
                self.db.query(Timetable)
                .filter(Timetable.school_id == school_id, Timetable.is_active.is_(True))
                .first()
            )

        if not timetable:
            timetable = (
                self.db.query(Timetable)
                .filter(Timetable.school_id == school_id)
                .order_by(Timetable.created_at.desc())
                .first()
            )

        school = self.db.query(School).filter(School.id == school_id).first()
        school_name = school.name if school else "School"

        # 2. Fetch Wings, Classes, Sections
        wings_q = (
            self.db.query(Wing)
            .filter(Wing.school_id == school_id, Wing.deleted_at.is_(None))
            .order_by(Wing.order_index.asc(), Wing.name.asc())
        )
        if wing_ids:
            wings_q = wings_q.filter(Wing.id.in_(wing_ids))
        wings = wings_q.all()

        all_classes_q = (
            self.db.query(SchoolClass)
            .filter(SchoolClass.school_id == school_id, SchoolClass.deleted_at.is_(None))
            .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc())
        )
        if class_ids:
            all_classes_q = all_classes_q.filter(SchoolClass.id.in_(class_ids))
        all_classes = all_classes_q.all()
        class_map = {c.id: c for c in all_classes}

        sections_q = (
            self.db.query(Section)
            .join(SchoolClass, SchoolClass.id == Section.class_id)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .options(joinedload(Section.school_class))
            .order_by(SchoolClass.order_index.asc(), Section.name.asc())
        )
        if section_ids:
            sections_q = sections_q.filter(Section.id.in_(section_ids))
        elif class_ids:
            sections_q = sections_q.filter(Section.class_id.in_(class_ids))
        sections = sections_q.all()

        # 3. Fetch Setups for this timetable
        setups = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.school_id == school_id,
                TimetableSetup.timetable_id == (timetable.id if timetable else None),
                TimetableSetup.deleted_at.is_(None),
            )
            .order_by(TimetableSetup.order_index.asc(), TimetableSetup.created_at.asc())
            .all()
        )

        # 4. Fetch Periods
        periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.school_id == school_id,
                or_(
                    TimetablePeriod.timetable_id == (timetable.id if timetable else None),
                    TimetablePeriod.timetable_id.is_(None),
                ),
                TimetablePeriod.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc())
            .all()
        )

        # 5. Fetch Entries
        entries_q = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.period),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                or_(
                    TimetableEntry.timetable_id == (timetable.id if timetable else None),
                    TimetableEntry.timetable_id.is_(None),
                ),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
            )
        )
        all_entries = entries_q.all()

        # 6. Fetch Eligible Teachers
        teachers_q = (
            self.db.query(User)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .options(joinedload(User.staff_profile))
            .filter(
                StaffProfile.school_id == school_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                User.role == UserRole.STAFF,
            )
            .order_by(User.first_name.asc(), User.last_name.asc())
        )
        if teacher_ids:
            teachers_q = teachers_q.filter(User.id.in_(teacher_ids))
        teachers = teachers_q.all()

        # 7. Create Workbook
        wb = openpyxl.Workbook()
        # Remove default sheet
        wb.remove(wb.active)

        scope_lower = (scope or "both").lower().strip()

        if scope_lower in ("classwise", "both"):
            self._build_classwise_sheet(
                wb=wb,
                school_name=school_name,
                timetable=timetable,
                sections=sections,
                setups=setups,
                periods=periods,
                entries=all_entries,
                color_coded=color_coded,
            )

        if scope_lower in ("teacherwise", "both"):
            self._build_teacherwise_sheet(
                wb=wb,
                school_name=school_name,
                timetable=timetable,
                teachers=teachers,
                setups=setups,
                periods=periods,
                entries=all_entries,
                color_coded=color_coded,
            )

        # Ensure at least one sheet exists
        if not wb.sheetnames:
            ws = wb.create_sheet(title="Timetable")
            ws.cell(1, 1, "No timetable data available for selected filters.")

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    # -----------------------------------------------------------------------
    # Helper: Build Class-wise Sheet
    # -----------------------------------------------------------------------
    def _build_classwise_sheet(
        self,
        wb: openpyxl.Workbook,
        school_name: str,
        timetable: Optional[Timetable],
        sections: List[Section],
        setups: List[TimetableSetup],
        periods: List[TimetablePeriod],
        entries: List[TimetableEntry],
        color_coded: bool,
    ):
        ws = wb.create_sheet(title="Class-wise Timetable")
        ws.views.sheetView[0].showGridLines = True

        # Index entries by (section_id, day_of_week, period_id)
        # and by (section_id, day_of_week, period_number)
        entry_map: Dict[str, TimetableEntry] = {}
        for e in entries:
            p = e.period
            p_num = p.period_number if p else 0
            k1 = f"{e.section_id}_{e.day_of_week}_{e.period_id}"
            k2 = f"{e.section_id}_{e.day_of_week}_{p_num}"
            entry_map[k1] = e
            entry_map[k2] = e

        # Map section to its setup
        sec_to_setup: Dict[UUID, TimetableSetup] = {}
        for s in setups:
            raw_sec_ids = s.assigned_section_ids or []
            if isinstance(raw_sec_ids, str):
                try:
                    raw_sec_ids = json.loads(raw_sec_ids)
                except Exception:
                    raw_sec_ids = []
            for sec_id_str in raw_sec_ids:
                try:
                    sec_to_setup[UUID(str(sec_id_str))] = s
                except Exception:
                    pass

        current_row = 1

        # Global Sheet Header
        tt_title = timetable.name if timetable else "Timetable"
        acad_year = timetable.academic_year if (timetable and timetable.academic_year) else ""
        header_text = f"{school_name.upper()} — {tt_title.upper()}"
        if acad_year:
            header_text += f" ({acad_year})"

        ws.cell(current_row, 1, header_text)
        ws.cell(current_row, 1).font = Font(name="Segoe UI", size=14, bold=True, color="FF0F172A")
        ws.row_dimensions[current_row].height = 28
        current_row += 1

        ws.cell(current_row, 1, "Class-wise Academic Bell Schedule & Faculty Roster")
        ws.cell(current_row, 1).font = Font(name="Segoe UI", size=10, italic=True, color="FF64748B")
        ws.row_dimensions[current_row].height = 20
        current_row += 2  # Blank line

        # Standard Days
        default_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

        # Track max column used across tables to format widths
        max_col_used = 10

        for section in sections:
            cls = section.school_class
            cls_name = cls.name if cls else "Class"
            sec_name = section.name

            # Determine setup for this section
            setup = sec_to_setup.get(section.id) or (setups[0] if setups else None)

            # Determine applicable days and periods
            sec_days = default_days
            sec_periods = periods

            if setup:
                raw_days = setup.applicable_days
                if isinstance(raw_days, str):
                    try:
                        raw_days = json.loads(raw_days)
                    except Exception:
                        raw_days = default_days
                if isinstance(raw_days, list) and raw_days:
                    sec_days = [str(d).upper() for d in raw_days]

                if setup.periods:
                    sec_periods = sorted(
                        [p for p in setup.periods if not getattr(p, "deleted_at", None)],
                        key=lambda p: p.period_number,
                    )

            if not sec_periods:
                sec_periods = periods

            col_count = len(sec_periods) + 1  # 1 for Day column
            max_col_used = max(max_col_used, col_count)

            # 1. Section Title Banner
            ws.merge_cells(
                start_row=current_row,
                start_column=1,
                end_row=current_row,
                end_column=col_count,
            )
            banner_cell = ws.cell(current_row, 1, f"CLASS {cls_name} - {sec_name}".upper())
            banner_cell.font = FONT_TITLE
            banner_cell.fill = FILL_TITLE
            banner_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
            ws.row_dimensions[current_row].height = 26

            # Apply border to all cells in merged title
            for c in range(1, col_count + 1):
                ws.cell(current_row, c).border = BORDER_BOX
                ws.cell(current_row, c).fill = FILL_TITLE

            current_row += 1

            # 2. Period Header Row
            ws.row_dimensions[current_row].height = 30
            day_hdr_cell = ws.cell(current_row, 1, "DAYS")
            day_hdr_cell.font = FONT_HEADER
            day_hdr_cell.fill = FILL_HEADER
            day_hdr_cell.alignment = ALIGN_CENTER
            day_hdr_cell.border = BORDER_HEADER

            for p_idx, p in enumerate(sec_periods, start=2):
                p_label = p.name or f"Period {p.period_number}"
                t_start = _format_time_12h(p.start_time)
                t_end = _format_time_12h(p.end_time)
                time_range = f"{t_start} - {t_end}" if (t_start and t_end) else ""
                hdr_val = f"{p_label}\n{time_range}".strip()

                cell = ws.cell(current_row, p_idx, hdr_val)
                cell.font = FONT_HEADER
                cell.fill = FILL_HEADER
                cell.alignment = ALIGN_CENTER
                cell.border = BORDER_HEADER

            current_row += 1

            # 3. Day Rows
            for day in sec_days:
                ws.row_dimensions[current_row].height = 36
                day_cell = ws.cell(current_row, 1, day[:3])  # MON, TUE, WED
                day_cell.font = FONT_DAY
                day_cell.fill = FILL_DAY
                day_cell.alignment = ALIGN_CENTER
                day_cell.border = BORDER_BOX

                for p_idx, p in enumerate(sec_periods, start=2):
                    cell = ws.cell(current_row, p_idx)
                    cell.border = BORDER_BOX
                    cell.alignment = ALIGN_CENTER

                    if p.is_break:
                        cell.value = p.name or "RECESS"
                        cell.font = Font(name="Segoe UI", size=9, bold=True, italic=True, color="FF64748B")
                        cell.fill = PatternFill(
                            fill_type="solid",
                            start_color=SUBJECT_PALETTE_HEX["break"]["fill"],
                            end_color=SUBJECT_PALETTE_HEX["break"]["fill"],
                        )
                        continue

                    # Lookup entry
                    entry = entry_map.get(f"{section.id}_{day}_{p.id}") or entry_map.get(
                        f"{section.id}_{day}_{p.period_number}"
                    )

                    if entry and entry.subject:
                        subj_name = entry.subject.name or "Subject"
                        teacher_name = ""
                        if entry.teacher:
                            t = entry.teacher
                            teacher_name = f"{t.first_name or ''} {t.last_name or ''}".strip()

                        if teacher_name:
                            cell.value = f"{subj_name}\n({teacher_name})"
                        else:
                            cell.value = subj_name

                        if color_coded:
                            theme = get_subject_hex_color(subj_name, entry.subject.category or "")
                            cell.fill = PatternFill(
                                fill_type="solid",
                                start_color=theme["fill"],
                                end_color=theme["fill"],
                            )
                            cell.font = Font(name="Segoe UI", size=9, bold=True, color=theme["text"])
                        else:
                            cell.font = Font(name="Segoe UI", size=9, bold=True, color="FF1E293B")
                    else:
                        cell.value = ""
                        cell.font = Font(name="Segoe UI", size=9, color="FF94A3B8")

                current_row += 1

            # Spacing between class tables
            current_row += 2

        # Auto-adjust column widths
        ws.column_dimensions["A"].width = 12
        for col in range(2, max_col_used + 2):
            col_letter = get_column_letter(col)
            ws.column_dimensions[col_letter].width = 22

    # -----------------------------------------------------------------------
    # Helper: Build Teacher-wise Sheet
    # -----------------------------------------------------------------------
    def _build_teacherwise_sheet(
        self,
        wb: openpyxl.Workbook,
        school_name: str,
        timetable: Optional[Timetable],
        teachers: List[User],
        setups: List[TimetableSetup],
        periods: List[TimetablePeriod],
        entries: List[TimetableEntry],
        color_coded: bool,
    ):
        ws = wb.create_sheet(title="Teacher-wise Timetable")
        ws.views.sheetView[0].showGridLines = True

        # Group entries by teacher_user_id -> day_of_week -> period_id / period_number
        teacher_entries: Dict[UUID, Dict[str, TimetableEntry]] = {}
        teacher_workload: Dict[UUID, int] = {}

        for e in entries:
            if not e.teacher_user_id:
                continue
            t_id = e.teacher_user_id
            teacher_entries.setdefault(t_id, {})
            p = e.period
            p_num = p.period_number if p else 0
            k1 = f"{e.day_of_week}_{e.period_id}"
            k2 = f"{e.day_of_week}_{p_num}"
            teacher_entries[t_id][k1] = e
            teacher_entries[t_id][k2] = e

            if not (p and p.is_break):
                teacher_workload[t_id] = teacher_workload.get(t_id, 0) + 1

        current_row = 1

        # Global Sheet Header
        tt_title = timetable.name if timetable else "Timetable"
        acad_year = timetable.academic_year if (timetable and timetable.academic_year) else ""
        header_text = f"{school_name.upper()} — {tt_title.upper()}"
        if acad_year:
            header_text += f" ({acad_year})"

        ws.cell(current_row, 1, header_text)
        ws.cell(current_row, 1).font = Font(name="Segoe UI", size=14, bold=True, color="FF0F172A")
        ws.row_dimensions[current_row].height = 28
        current_row += 1

        ws.cell(current_row, 1, "Teacher-wise Master Faculty Schedules & Lecture Allocations")
        ws.cell(current_row, 1).font = Font(name="Segoe UI", size=10, italic=True, color="FF64748B")
        ws.row_dimensions[current_row].height = 20
        current_row += 2  # Blank line

        default_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

        # Master periods across setups or school periods
        master_periods = periods
        if not master_periods and setups:
            for s in setups:
                if s.periods:
                    master_periods = sorted(
                        [p for p in s.periods if not getattr(p, "deleted_at", None)],
                        key=lambda p: p.period_number,
                    )
                    break

        col_count = len(master_periods) + 1
        max_col_used = max(10, col_count)

        for teacher in teachers:
            sp = teacher.staff_profile
            t_name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip()
            dept = sp.department if (sp and sp.department) else (sp.designation if sp else "")
            assigned_count = teacher_workload.get(teacher.id, 0)

            # 1. Teacher Banner
            ws.merge_cells(
                start_row=current_row,
                start_column=1,
                end_row=current_row,
                end_column=col_count,
            )
            title_text = f"TEACHER: {t_name.upper()}"
            if dept:
                title_text += f" ({dept.upper()})"
            title_text += f"   •   ASSIGNED: {assigned_count} PDS/WK"

            banner_cell = ws.cell(current_row, 1, title_text)
            banner_cell.font = FONT_TITLE
            banner_cell.fill = FILL_TITLE
            banner_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
            ws.row_dimensions[current_row].height = 26

            for c in range(1, col_count + 1):
                ws.cell(current_row, c).border = BORDER_BOX
                ws.cell(current_row, c).fill = FILL_TITLE

            current_row += 1

            # 2. Period Header Row
            ws.row_dimensions[current_row].height = 30
            day_hdr_cell = ws.cell(current_row, 1, "DAYS")
            day_hdr_cell.font = FONT_HEADER
            day_hdr_cell.fill = FILL_HEADER
            day_hdr_cell.alignment = ALIGN_CENTER
            day_hdr_cell.border = BORDER_HEADER

            for p_idx, p in enumerate(master_periods, start=2):
                p_label = p.name or f"Period {p.period_number}"
                t_start = _format_time_12h(p.start_time)
                t_end = _format_time_12h(p.end_time)
                time_range = f"{t_start} - {t_end}" if (t_start and t_end) else ""
                hdr_val = f"{p_label}\n{time_range}".strip()

                cell = ws.cell(current_row, p_idx, hdr_val)
                cell.font = FONT_HEADER
                cell.fill = FILL_HEADER
                cell.alignment = ALIGN_CENTER
                cell.border = BORDER_HEADER

            current_row += 1

            # 3. Day Rows
            t_map = teacher_entries.get(teacher.id, {})

            for day in default_days:
                ws.row_dimensions[current_row].height = 36
                day_cell = ws.cell(current_row, 1, day[:3])
                day_cell.font = FONT_DAY
                day_cell.fill = FILL_DAY
                day_cell.alignment = ALIGN_CENTER
                day_cell.border = BORDER_BOX

                for p_idx, p in enumerate(master_periods, start=2):
                    cell = ws.cell(current_row, p_idx)
                    cell.border = BORDER_BOX
                    cell.alignment = ALIGN_CENTER

                    if p.is_break:
                        cell.value = p.name or "RECESS"
                        cell.font = Font(name="Segoe UI", size=9, bold=True, italic=True, color="FF64748B")
                        cell.fill = PatternFill(
                            fill_type="solid",
                            start_color=SUBJECT_PALETTE_HEX["break"]["fill"],
                            end_color=SUBJECT_PALETTE_HEX["break"]["fill"],
                        )
                        continue

                    # Lookup teacher entry
                    entry = t_map.get(f"{day}_{p.id}") or t_map.get(f"{day}_{p.period_number}")

                    if entry and entry.section:
                        sec = entry.section
                        cls_name = sec.school_class.name if sec.school_class else ""
                        sec_label = f"{cls_name} {sec.name}".strip()
                        subj_name = entry.subject.name if entry.subject else ""

                        if subj_name:
                            cell.value = f"{sec_label}\n({subj_name})"
                        else:
                            cell.value = sec_label

                        if color_coded and subj_name:
                            theme = get_subject_hex_color(subj_name, entry.subject.category or "")
                            cell.fill = PatternFill(
                                fill_type="solid",
                                start_color=theme["fill"],
                                end_color=theme["fill"],
                            )
                            cell.font = Font(name="Segoe UI", size=9, bold=True, color=theme["text"])
                        else:
                            cell.font = Font(name="Segoe UI", size=9, bold=True, color="FF1E293B")
                    else:
                        # Free period
                        cell.value = "-"
                        cell.font = Font(name="Segoe UI", size=9, color="FF94A3B8")
                        cell.fill = PatternFill(fill_type=None)

                current_row += 1

            # Spacing between teacher tables
            current_row += 2

        # Auto-adjust column widths
        ws.column_dimensions["A"].width = 12
        for col in range(2, max_col_used + 2):
            col_letter = get_column_letter(col)
            ws.column_dimensions[col_letter].width = 22
