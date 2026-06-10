"""シフト管理ロジック"""
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .models import Employee, ShiftEntry
from .config import SHIFT_TYPES, MAX_CONSECUTIVE_WORK_DAYS, REQUIRED_STAFF


class ShiftScheduler:
    def __init__(self, employees: Dict[str, Employee], shifts: List[ShiftEntry]):
        self.employees = employees
        self.shifts = shifts
        # (employee_id, date) -> ShiftEntry のインデックス
        self._index: Dict[Tuple[str, str], int] = {
            (s.employee_id, s.date): i for i, s in enumerate(shifts)
        }

    # ---- CRUD ----

    def set_shift(self, employee_id: str, date_str: str, shift_type: str, memo: str = ""):
        """シフトをセット（既存があれば上書き）"""
        key = (employee_id, date_str)
        entry = ShiftEntry(employee_id=employee_id, date=date_str, shift_type=shift_type, memo=memo)
        if key in self._index:
            self.shifts[self._index[key]] = entry
        else:
            self._index[key] = len(self.shifts)
            self.shifts.append(entry)

    def get_shift(self, employee_id: str, date_str: str) -> Optional[ShiftEntry]:
        key = (employee_id, date_str)
        if key in self._index:
            return self.shifts[self._index[key]]
        return None

    def delete_shift(self, employee_id: str, date_str: str):
        key = (employee_id, date_str)
        if key in self._index:
            idx = self._index.pop(key)
            self.shifts.pop(idx)
            # インデックス再構築
            self._index = {(s.employee_id, s.date): i for i, s in enumerate(self.shifts)}

    def bulk_set(self, employee_id: str, date_list: List[str], shift_type: str):
        """複数日を一括セット"""
        for d in date_list:
            self.set_shift(employee_id, d, shift_type)

    # ---- 月次シフト取得 ----

    def get_month_dates(self, year: int, month: int) -> List[str]:
        """指定月の全日付リストを返す"""
        from calendar import monthrange
        _, last = monthrange(year, month)
        return [f"{year}-{month:02d}-{d:02d}" for d in range(1, last + 1)]

    def get_month_matrix(self, year: int, month: int) -> Dict[str, Dict[str, str]]:
        """
        {employee_id: {date_str: shift_type}} の形で月シフトを返す
        シフト未設定の日は config.DEFAULT_SHIFT
        """
        from .config import DEFAULT_SHIFT
        dates = self.get_month_dates(year, month)
        result = {}
        for eid in self.employees:
            result[eid] = {}
            for d in dates:
                entry = self.get_shift(eid, d)
                result[eid][d] = entry.shift_type if entry else DEFAULT_SHIFT
        return result

    # ---- バリデーション ----

    def validate_month(self, year: int, month: int) -> List[str]:
        """問題のあるシフトをリストで返す"""
        warnings = []
        matrix = self.get_month_matrix(year, month)
        dates = self.get_month_dates(year, month)

        # 連続勤務チェック
        rest_shifts = {"休み", "有休"}
        for eid, emp in self.employees.items():
            consecutive = 0
            for d in dates:
                stype = matrix[eid][d]
                if stype not in rest_shifts:
                    consecutive += 1
                    if consecutive > MAX_CONSECUTIVE_WORK_DAYS:
                        warnings.append(f"⚠️ {emp.name}: {d} まで{consecutive}日連続勤務")
                else:
                    consecutive = 0

        # 必要人数チェック
        for d in dates:
            count_by_type: Dict[str, int] = defaultdict(int)
            for eid in self.employees:
                stype = matrix[eid][d]
                count_by_type[stype] += 1
            for stype, required in REQUIRED_STAFF.items():
                if count_by_type.get(stype, 0) < required:
                    warnings.append(
                        f"⚠️ {d} [{stype}] 必要{required}人 / 現在{count_by_type.get(stype,0)}人"
                    )

        return warnings

    # ---- 集計 ----

    def summarize_month(self, year: int, month: int) -> Dict[str, Dict[str, int]]:
        """
        {employee_id: {shift_type: 日数}} の月集計を返す
        """
        matrix = self.get_month_matrix(year, month)
        summary = {}
        for eid, day_map in matrix.items():
            counts: Dict[str, int] = defaultdict(int)
            for stype in day_map.values():
                counts[stype] += 1
            summary[eid] = dict(counts)
        return summary
