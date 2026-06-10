"""JSONファイルへのデータ永続化"""
import json
import os
from typing import Dict, List

from .models import Employee, ShiftEntry
from .config import DATA_DIR, EMPLOYEES_FILE, SHIFTS_FILE


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


# ---------- Employee ----------

def load_employees() -> Dict[str, Employee]:
    _ensure_data_dir()
    if not os.path.exists(EMPLOYEES_FILE):
        return {}
    with open(EMPLOYEES_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    return {eid: Employee.from_dict(data) for eid, data in raw.items()}


def save_employees(employees: Dict[str, Employee]):
    _ensure_data_dir()
    with open(EMPLOYEES_FILE, "w", encoding="utf-8") as f:
        json.dump({eid: emp.to_dict() for eid, emp in employees.items()}, f, ensure_ascii=False, indent=2)


# ---------- Shifts ----------

def load_shifts() -> List[ShiftEntry]:
    _ensure_data_dir()
    if not os.path.exists(SHIFTS_FILE):
        return []
    with open(SHIFTS_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    return [ShiftEntry.from_dict(d) for d in raw]


def save_shifts(shifts: List[ShiftEntry]):
    _ensure_data_dir()
    with open(SHIFTS_FILE, "w", encoding="utf-8") as f:
        json.dump([s.to_dict() for s in shifts], f, ensure_ascii=False, indent=2)
