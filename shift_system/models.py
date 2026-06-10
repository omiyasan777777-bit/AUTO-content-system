"""データモデル定義"""
from dataclasses import dataclass, field
from typing import Optional
from datetime import date


@dataclass
class Employee:
    id: str
    name: str
    role: str = "一般"                          # 役職（管理職/リーダー/一般など自由に設定）
    employment_type: str = "正社員"             # 雇用形態（正社員/パート/アルバイト等）
    weekly_hours: int = 40                      # 週所定労働時間
    available_shifts: list = field(default_factory=lambda: [])  # 担当可能シフト（空=全て可）
    notes: str = ""                             # 備考

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "employment_type": self.employment_type,
            "weekly_hours": self.weekly_hours,
            "available_shifts": self.available_shifts,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Employee":
        return cls(**data)


@dataclass
class ShiftEntry:
    employee_id: str
    date: str           # "YYYY-MM-DD"
    shift_type: str     # config.SHIFT_TYPES のキー
    memo: str = ""      # 個別メモ（早退/遅刻/特記事項など）

    def to_dict(self) -> dict:
        return {
            "employee_id": self.employee_id,
            "date": self.date,
            "shift_type": self.shift_type,
            "memo": self.memo,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ShiftEntry":
        return cls(**data)
