"""シフト管理システム CLIエントリーポイント"""
import sys
import os
from datetime import date, datetime

# パスを通す
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shift_system import data_manager as dm
from shift_system.models import Employee
from shift_system.scheduler import ShiftScheduler
from shift_system.config import SHIFT_TYPES


def _input(prompt: str) -> str:
    return input(prompt).strip()


def _print_sep():
    print("=" * 60)


def _print_menu():
    _print_sep()
    print("  シフト管理システム - メインメニュー")
    _print_sep()
    print("  1. 従業員を登録・管理")
    print("  2. シフトを入力・編集")
    print("  3. 月次シフト確認")
    print("  4. Excelに出力")
    print("  5. バリデーション（問題チェック）")
    print("  6. サンプルデータ生成（デモ用）")
    print("  0. 終了")
    _print_sep()


def handle_employee_menu(employees):
    while True:
        _print_sep()
        print("  【従業員管理】")
        print("  1. 一覧表示")
        print("  2. 従業員を追加")
        print("  3. 従業員情報を編集")
        print("  4. 従業員を削除")
        print("  0. 戻る")
        _print_sep()
        choice = _input("選択: ")

        if choice == "0":
            break
        elif choice == "1":
            if not employees:
                print("  従業員が登録されていません。")
            else:
                print(f"\n  {'ID':<6} {'氏名':<12} {'役職':<10} {'雇用形態':<10}")
                print("  " + "-" * 44)
                for emp in employees.values():
                    print(f"  {emp.id:<6} {emp.name:<12} {emp.role:<10} {emp.employment_type:<10}")
        elif choice == "2":
            emp_id = f"E{len(employees)+1:03d}"
            name = _input(f"  氏名: ")
            role = _input(f"  役職（例:一般/リーダー/管理職）[一般]: ") or "一般"
            emp_type = _input(f"  雇用形態（正社員/パート/アルバイト）[正社員]: ") or "正社員"
            weekly = _input(f"  週所定時間 [40]: ") or "40"
            notes = _input(f"  備考（任意）: ")
            emp = Employee(
                id=emp_id, name=name, role=role,
                employment_type=emp_type,
                weekly_hours=int(weekly), notes=notes
            )
            employees[emp_id] = emp
            dm.save_employees(employees)
            print(f"  ✅ {name}（{emp_id}）を登録しました。")
        elif choice == "3":
            emp_id = _input("  編集する従業員ID: ")
            if emp_id not in employees:
                print("  ❌ 従業員が見つかりません。")
                continue
            emp = employees[emp_id]
            print(f"  現在: {emp.name} / {emp.role} / {emp.employment_type}")
            name = _input(f"  新しい氏名 [{emp.name}]: ") or emp.name
            role = _input(f"  新しい役職 [{emp.role}]: ") or emp.role
            emp_type = _input(f"  新しい雇用形態 [{emp.employment_type}]: ") or emp.employment_type
            emp.name, emp.role, emp.employment_type = name, role, emp_type
            dm.save_employees(employees)
            print(f"  ✅ 更新しました。")
        elif choice == "4":
            emp_id = _input("  削除する従業員ID: ")
            if emp_id in employees:
                confirm = _input(f"  {employees[emp_id].name} を削除しますか？(y/N): ")
                if confirm.lower() == "y":
                    del employees[emp_id]
                    dm.save_employees(employees)
                    print("  ✅ 削除しました。")
            else:
                print("  ❌ 従業員が見つかりません。")


def handle_shift_input(employees, shifts):
    scheduler = ShiftScheduler(employees, shifts)
    shift_keys = list(SHIFT_TYPES.keys())

    _print_sep()
    print("  【シフト入力】")
    print("  ※ 一括入力: 従業員IDと日付範囲でまとめて設定可能")
    _print_sep()

    # 従業員選択
    if not employees:
        print("  ❌ 先に従業員を登録してください。")
        return shifts

    print("  従業員一覧:")
    for emp in employees.values():
        print(f"    {emp.id}: {emp.name}")

    emp_id = _input("  従業員ID（全員=all）: ")
    target_ids = list(employees.keys()) if emp_id == "all" else [emp_id]
    if not all(eid in employees for eid in target_ids):
        print("  ❌ 従業員が見つかりません。")
        return shifts

    # 日付入力
    date_input = _input("  日付（YYYY-MM-DD または YYYY-MM-DD〜YYYY-MM-DD）: ")
    if "〜" in date_input or "~" in date_input:
        from datetime import timedelta
        sep = "〜" if "〜" in date_input else "~"
        start_str, end_str = date_input.split(sep)
        start = datetime.strptime(start_str.strip(), "%Y-%m-%d").date()
        end = datetime.strptime(end_str.strip(), "%Y-%m-%d").date()
        date_list = []
        cur = start
        while cur <= end:
            date_list.append(cur.isoformat())
            cur += timedelta(days=1)
    else:
        date_list = [date_input.strip()]

    # シフト種別選択
    print("\n  シフト種別:")
    for i, k in enumerate(shift_keys):
        info = SHIFT_TYPES[k]
        time_str = f"{info['start']}〜{info['end']}" if info["start"] else "—"
        print(f"    {i+1}. {k}  {time_str}")
    stype_idx = _input("  番号を選択: ")
    try:
        stype = shift_keys[int(stype_idx) - 1]
    except (ValueError, IndexError):
        print("  ❌ 無効な選択です。")
        return shifts

    memo = _input("  メモ（任意）: ")

    for eid in target_ids:
        scheduler.bulk_set(eid, date_list, stype)
        if memo:
            for d in date_list:
                scheduler.set_shift(eid, d, stype, memo)

    dm.save_shifts(scheduler.shifts)
    print(f"  ✅ {len(target_ids)}人 × {len(date_list)}日 → [{stype}] を設定しました。")
    return scheduler.shifts


def handle_view(employees, shifts):
    year_str = _input(f"  年 [{date.today().year}]: ") or str(date.today().year)
    month_str = _input(f"  月 [{date.today().month}]: ") or str(date.today().month)
    year, month = int(year_str), int(month_str)

    scheduler = ShiftScheduler(employees, shifts)
    matrix = scheduler.get_month_matrix(year, month)
    dates = scheduler.get_month_dates(year, month)

    # ヘッダー
    header = f"{'氏名':<10}" + "".join(f"{d.split('-')[2]:>3}" for d in dates)
    print("\n" + header)
    print("-" * len(header))

    abbr = {k: k[:2] for k in SHIFT_TYPES}
    for emp in employees.values():
        row = f"{emp.name:<10}"
        for d in dates:
            stype = matrix[emp.id][d]
            row += f"{abbr.get(stype, '??'):>3}"
        print(row)


def handle_export(employees, shifts):
    year_str = _input(f"  年 [{date.today().year}]: ") or str(date.today().year)
    month_str = _input(f"  月 [{date.today().month}]: ") or str(date.today().month)
    year, month = int(year_str), int(month_str)

    default_path = f"shift_system/output/shift_{year}{month:02d}.xlsx"
    path = _input(f"  出力先 [{default_path}]: ") or default_path

    scheduler = ShiftScheduler(employees, shifts)
    from shift_system.excel_exporter import export_month
    result = export_month(scheduler, year, month, path)
    print(f"  ✅ 出力完了: {result}")


def handle_validate(employees, shifts):
    year_str = _input(f"  年 [{date.today().year}]: ") or str(date.today().year)
    month_str = _input(f"  月 [{date.today().month}]: ") or str(date.today().month)
    year, month = int(year_str), int(month_str)

    scheduler = ShiftScheduler(employees, shifts)
    warnings = scheduler.validate_month(year, month)
    if not warnings:
        print("  ✅ 問題はありません。")
    else:
        print(f"\n  {len(warnings)} 件の問題が見つかりました:")
        for w in warnings:
            print(f"  {w}")


def generate_sample_data(employees, shifts):
    """15人のサンプルデータを生成"""
    sample_names = [
        ("田中 太郎", "リーダー", "正社員"),
        ("佐藤 花子", "一般", "正社員"),
        ("鈴木 次郎", "一般", "正社員"),
        ("高橋 美咲", "一般", "パート"),
        ("伊藤 健一", "一般", "正社員"),
        ("渡辺 由紀", "一般", "アルバイト"),
        ("山本 浩二", "リーダー", "正社員"),
        ("中村 さくら", "一般", "パート"),
        ("小林 誠", "一般", "正社員"),
        ("加藤 恵子", "一般", "正社員"),
        ("吉田 大輔", "一般", "アルバイト"),
        ("松本 みゆき", "一般", "パート"),
        ("井上 剛", "管理職", "正社員"),
        ("木村 愛", "一般", "正社員"),
        ("林 翔太", "一般", "アルバイト"),
    ]
    for i, (name, role, emp_type) in enumerate(sample_names):
        emp_id = f"E{i+1:03d}"
        if emp_id not in employees:
            employees[emp_id] = Employee(
                id=emp_id, name=name, role=role, employment_type=emp_type
            )
    dm.save_employees(employees)

    # 今月のサンプルシフト
    from datetime import timedelta
    import random
    today = date.today()
    scheduler = ShiftScheduler(employees, shifts)
    shift_keys = [k for k in SHIFT_TYPES if k not in ("有休", "研修")]
    weights = [2, 5, 2, 1, 3]  # 早番/日勤/遅番/夜勤/休み

    from calendar import monthrange
    _, last_day = monthrange(today.year, today.month)
    random.seed(42)
    for emp in employees.values():
        for day in range(1, last_day + 1):
            d_str = f"{today.year}-{today.month:02d}-{day:02d}"
            stype = random.choices(shift_keys, weights=weights)[0]
            scheduler.set_shift(emp.id, d_str, stype)

    dm.save_shifts(scheduler.shifts)
    print(f"  ✅ {len(employees)} 人のサンプルデータを生成しました。")
    return employees, scheduler.shifts


def main():
    print("\n  シフト管理システム 起動中...\n")
    employees = dm.load_employees()
    shifts = dm.load_shifts()

    while True:
        _print_menu()
        choice = _input("選択: ")

        if choice == "0":
            print("  終了します。")
            break
        elif choice == "1":
            handle_employee_menu(employees)
        elif choice == "2":
            shifts = handle_shift_input(employees, shifts)
        elif choice == "3":
            handle_view(employees, shifts)
        elif choice == "4":
            handle_export(employees, shifts)
        elif choice == "5":
            handle_validate(employees, shifts)
        elif choice == "6":
            employees, shifts = generate_sample_data(employees, shifts)
        else:
            print("  無効な選択です。")


if __name__ == "__main__":
    main()
