"""
シフトシステム設定ファイル
ここを変更するだけでシフト時間帯・ルール・表示形式をカスタマイズできます
"""

# シフト時間帯定義（自由に追加・変更可能）
SHIFT_TYPES = {
    "早番": {"start": "07:00", "end": "15:00", "color": "ADD8E6"},   # ライトブルー
    "日勤": {"start": "09:00", "end": "18:00", "color": "90EE90"},   # ライトグリーン
    "遅番": {"start": "13:00", "end": "22:00", "color": "FFD700"},   # ゴールド
    "夜勤": {"start": "22:00", "end": "07:00", "color": "DDA0DD"},   # プラム
    "休み": {"start": "",      "end": "",       "color": "D3D3D3"},   # ライトグレー
    "有休": {"start": "",      "end": "",       "color": "FFA07A"},   # サーモン
    "研修": {"start": "09:00", "end": "18:00", "color": "F0E68C"},   # カーキ
}

# デフォルト設定
DEFAULT_SHIFT = "休み"

# 週の開始曜日 (0=月曜日, 6=日曜日)
WEEK_START = 0

# 曜日ラベル
WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]

# 1日の必要人数（時間帯別）※ 超過アラート用
REQUIRED_STAFF = {
    "早番": 2,
    "日勤": 3,
    "遅番": 2,
    "夜勤": 1,
}

# 連続勤務の警告日数
MAX_CONSECUTIVE_WORK_DAYS = 5

# Excel出力設定
EXCEL_SETTINGS = {
    "sheet_name": "シフト表",
    "header_color": "4472C4",       # ヘッダー背景色（青）
    "header_font_color": "FFFFFF",  # ヘッダー文字色（白）
    "weekend_color": "FFF2CC",      # 土日背景色
    "today_color": "E2EFDA",        # 今日の列の色
    "font_name": "游ゴシック",
    "font_size": 11,
}

# データ保存ファイルパス
DATA_DIR = "shift_system/data"
EMPLOYEES_FILE = "shift_system/data/employees.json"
SHIFTS_FILE = "shift_system/data/shifts.json"
