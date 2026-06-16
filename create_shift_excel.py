#!/usr/bin/env python3
"""
シフト管理Excelファイル生成スクリプト
- Sheet1: 月間シフト表（編集可能）
- Sheet2: 11日〜翌10日の集計グラフ連動シート
"""

import zipfile
import os
import re
from datetime import datetime, date, timedelta
import calendar
import argparse

# ============================================================
# 設定
# ============================================================
EMPLOYEES = ["田中", "佐藤", "鈴木", "山田", "伊藤"]  # 従業員名（変更可）
SHIFTS = {
    "早": "6:00-14:00",
    "日": "9:00-18:00",
    "遅": "14:00-22:00",
    "休": "休み",
    "": "未定",
}

# ============================================================
# ユーティリティ
# ============================================================
def col_letter(n):
    """1始まりの列番号 → Excelの列文字（A, B, ..., Z, AA, ...）"""
    result = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result

def xml_escape(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

# ============================================================
# SharedStrings（文字列プール）
# ============================================================
class SharedStrings:
    def __init__(self):
        self._strings = []
        self._index = {}

    def add(self, s):
        s = str(s)
        if s not in self._index:
            self._index[s] = len(self._strings)
            self._strings.append(s)
        return self._index[s]

    def to_xml(self):
        items = "".join(
            f'<si><t xml:space="preserve">{xml_escape(s)}</t></si>'
            for s in self._strings
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            f' count="{len(self._strings)}" uniqueCount="{len(self._strings)}">'
            f"{items}</sst>"
        )

# ============================================================
# スタイル定義
# ============================================================
def styles_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="14"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="游ゴシック"/></font>
    <font><sz val="10"/><name val="游ゴシック"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF9C3"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFBBF7D0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E8"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
    <border>
      <left style="medium"><color rgb="FF2563EB"/></left>
      <right style="medium"><color rgb="FF2563EB"/></right>
      <top style="medium"><color rgb="FF2563EB"/></top>
      <bottom style="medium"><color rgb="FF2563EB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <!-- 0: 通常 -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: ヘッダー（青背景・白字・太字・中央） -->
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 2: 氏名セル（水色背景・太字・中央） -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 3: 通常セル（枠・中央） -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 4: 土曜ヘッダー（黄背景・中央） -->
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 5: 日曜ヘッダー（赤背景・中央） -->
    <xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 6: タイトル -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 7: 集計ヘッダー（青） -->
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 8: 集計数値（中央・枠） -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 9: 集計行ラベル（水色） -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 10: 土曜セル（黄薄） -->
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 11: 日曜セル（赤薄） -->
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 12: 集計緑 -->
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 13: グラフシートタイトル -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 14: 凡例セル -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>'''

# ============================================================
# Sheet1: 月間シフト表
# ============================================================
def build_shift_sheet(year, month, employees, ss):
    """シフト表シートのXMLを生成し、cell_data（行, 列, 値, 数式）を返す"""
    num_days = calendar.monthrange(year, month)[1]
    days = [date(year, month, d) for d in range(1, num_days + 1)]

    rows_xml = []

    # ---- 行1: タイトル ----
    title_str = f"{year}年{month}月 シフト表"
    si = ss.add(title_str)
    total_cols = 2 + num_days + 3  # 氏名+No + 日付 + 早計/遅計/出勤日数
    last_col = col_letter(total_cols)
    rows_xml.append(
        f'<row r="1" ht="28" customHeight="1">'
        f'<c r="A1" s="6" t="s"><v>{si}</v></c>'
        f'</row>'
    )

    # ---- 行2: 列ヘッダー ----
    cells = []
    cells.append(f'<c r="A2" s="1" t="s"><v>{ss.add("No")}</v></c>')
    cells.append(f'<c r="B2" s="1" t="s"><v>{ss.add("氏名")}</v></c>')
    for i, d in enumerate(days):
        col = col_letter(3 + i)
        wd = d.weekday()  # 0=月 6=日
        label = f'{d.day}\n({["月","火","水","木","金","土","日"][wd]})'
        si = ss.add(label)
        if wd == 5:
            sty = 4
        elif wd == 6:
            sty = 5
        else:
            sty = 1
        cells.append(f'<c r="{col}2" s="{sty}" t="s"><v>{si}</v></c>')
    # 集計列ヘッダー
    c_early  = col_letter(3 + num_days)
    c_late   = col_letter(3 + num_days + 1)
    c_work   = col_letter(3 + num_days + 2)
    lbl_early = ss.add("早番\n合計")
    lbl_late  = ss.add("遅番\n合計")
    lbl_work  = ss.add("出勤\n日数")
    cells.append(f'<c r="{c_early}2" s="7" t="s"><v>{lbl_early}</v></c>')
    cells.append(f'<c r="{c_late}2" s="7" t="s"><v>{lbl_late}</v></c>')
    cells.append(f'<c r="{c_work}2" s="7" t="s"><v>{lbl_work}</v></c>')
    rows_xml.append(f'<row r="2" ht="36" customHeight="1">{"".join(cells)}</row>')

    # ---- 行3〜: 従業員ごと ----
    for ei, emp in enumerate(employees):
        row_r = 3 + ei
        data_cols_start = 3
        first_data_col = col_letter(data_cols_start)
        last_data_col  = col_letter(2 + num_days)

        cells = []
        cells.append(f'<c r="A{row_r}" s="3"><v>{ei+1}</v></c>')
        cells.append(f'<c r="B{row_r}" s="2" t="s"><v>{ss.add(emp)}</v></c>')

        for i, d in enumerate(days):
            col = col_letter(3 + i)
            wd = d.weekday()
            # デフォルト: 土日は「休」、平日は「日」（通常シフト）
            default = "休" if wd >= 5 else "日"
            si = ss.add(default)
            if wd == 5:
                sty = 10
            elif wd == 6:
                sty = 11
            else:
                sty = 3
            cells.append(f'<c r="{col}{row_r}" s="{sty}" t="s"><v>{si}</v></c>')

        # COUNTIF 数式で集計
        range_str = f'{first_data_col}{row_r}:{last_data_col}{row_r}'
        early_si = ss.add("早")
        late_si  = ss.add("遅")
        cells.append(
            f'<c r="{c_early}{row_r}" s="12">'
            f'<f>COUNTIF({range_str},"早")</f><v>0</v></c>'
        )
        cells.append(
            f'<c r="{c_late}{row_r}" s="12">'
            f'<f>COUNTIF({range_str},"遅")</f><v>0</v></c>'
        )
        cells.append(
            f'<c r="{c_work}{row_r}" s="12">'
            f'<f>COUNTIF({range_str},"早")+COUNTIF({range_str},"日")+COUNTIF({range_str},"遅")</f>'
            f'<v>0</v></c>'
        )
        rows_xml.append(f'<row r="{row_r}">{"".join(cells)}</row>')

    # ---- 日別合計行 ----
    total_row = 3 + len(employees)
    cells = []
    cells.append(f'<c r="A{total_row}" s="1" t="s"><v>{ss.add("")}</v></c>')
    cells.append(f'<c r="B{total_row}" s="1" t="s"><v>{ss.add("日別出勤数")}</v></c>')
    for i in range(num_days):
        col = col_letter(3 + i)
        d = days[i]
        wd = d.weekday()
        # 出勤者数（早+日+遅）
        ranges = [f'{col}{3+ei}' for ei in range(len(employees))]
        count_parts = "+".join(
            f'IF({r}="早",1,IF({r}="日",1,IF({r}="遅",1,0)))'
            for r in ranges
        )
        if wd == 5:
            sty = 4
        elif wd == 6:
            sty = 5
        else:
            sty = 1
        cells.append(
            f'<c r="{col}{total_row}" s="{sty}">'
            f'<f>{count_parts}</f><v>0</v></c>'
        )
    rows_xml.append(f'<row r="{total_row}">{"".join(cells)}</row>')

    # ---- XML組立 ----
    # マージセル (タイトル行A1:lastCol1)
    merge_xml = (
        f'<mergeCells count="1">'
        f'<mergeCell ref="A1:{last_col}1"/>'
        f'</mergeCells>'
    )

    # 列幅
    col_defs = '<col min="1" max="1" width="6" customWidth="1"/>'   # No
    col_defs += '<col min="2" max="2" width="10" customWidth="1"/>'  # 氏名
    col_defs += f'<col min="3" max="{2+num_days}" width="6" customWidth="1"/>'
    col_defs += f'<col min="{3+num_days}" max="{2+num_days+3}" width="10" customWidth="1"/>'

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheetViews><sheetView tabSelected="1" workbookViewId="0">'
        f'<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>'
        f'</sheetView></sheetViews>'
        f'<cols>{col_defs}</cols>'
        f'<sheetData>{"".join(rows_xml)}</sheetData>'
        f'{merge_xml}'
        '<pageSetup orientation="landscape"/>'
        '</worksheet>'
    )
    return sheet_xml, num_days, len(employees), total_row

# ============================================================
# Sheet2: 11日〜翌10日 集計＋グラフ
# ============================================================
def build_graph_sheet(year, month, num_days, num_employees, total_row_s1, ss):
    """
    11日〜翌10日の日別出勤者数を集計テーブルとして出力。
    グラフは chart XML で埋め込む。
    """
    # 11日〜月末 + 翌月1日〜10日
    period_days = []
    for d in range(11, num_days + 1):
        period_days.append(date(year, month, d))
    next_year  = year if month < 12 else year + 1
    next_month = month + 1 if month < 12 else 1
    for d in range(1, 11):
        try:
            period_days.append(date(next_year, next_month, d))
        except ValueError:
            pass

    rows_xml = []

    # タイトル
    title = f"{year}年{month}月11日 〜 {next_year}年{next_month}月10日  シフトグラフ"
    si = ss.add(title)
    rows_xml.append(
        '<row r="1" ht="28" customHeight="1">'
        f'<c r="A1" s="13" t="s"><v>{si}</v></c>'
        '</row>'
    )

    # ヘッダー行
    cells = [
        f'<c r="A2" s="1" t="s"><v>{ss.add("日付")}</v></c>',
        f'<c r="B2" s="1" t="s"><v>{ss.add("曜日")}</v></c>',
        f'<c r="C2" s="1" t="s"><v>{ss.add("出勤者数")}</v></c>',
        f'<c r="D2" s="1" t="s"><v>{ss.add("早番")}</v></c>',
        f'<c r="E2" s="1" t="s"><v>{ss.add("日勤")}</v></c>',
        f'<c r="F2" s="1" t="s"><v>{ss.add("遅番")}</v></c>',
        f'<c r="G2" s="1" t="s"><v>{ss.add("備考")}</v></c>',
    ]
    rows_xml.append(f'<row r="2">{"".join(cells)}</row>')

    wd_names = ["月","火","水","木","金","土","日"]

    for ri, d in enumerate(period_days):
        row_r = 3 + ri
        wd = d.weekday()

        # Sheet1での列番号を計算
        if d.month == month:
            day_col = col_letter(2 + d.day)   # 3列目から日付開始 → col=2+day
            src_row = total_row_s1              # 日別合計行
        else:
            # 翌月分 → Sheet1には存在しない（別シートが必要）→ 空で仮置き
            day_col = None
            src_row = None

        if wd == 5:
            sty_label = 4; sty_val = 10
        elif wd == 6:
            sty_label = 5; sty_val = 11
        else:
            sty_label = 1; sty_val = 3

        date_str = f"{d.month}/{d.day}"
        cells = [
            f'<c r="A{row_r}" s="{sty_label}" t="s"><v>{ss.add(date_str)}</v></c>',
            f'<c r="B{row_r}" s="{sty_label}" t="s"><v>{ss.add(wd_names[wd])}</v></c>',
        ]

        if day_col and d.month == month:
            # Sheet1の日別合計行を参照
            ref = f"シフト表!{day_col}{src_row}"
            cells.append(f'<c r="C{row_r}" s="{sty_val}"><f>{ref}</f><v>0</v></c>')

            # 早/日/遅 各従業員の集計
            early_parts = "+".join(
                f'IF(シフト表!{day_col}{3+ei}="早",1,0)' for ei in range(num_employees)
            )
            day_parts = "+".join(
                f'IF(シフト表!{day_col}{3+ei}="日",1,0)' for ei in range(num_employees)
            )
            late_parts = "+".join(
                f'IF(シフト表!{day_col}{3+ei}="遅",1,0)' for ei in range(num_employees)
            )
            cells.append(f'<c r="D{row_r}" s="{sty_val}"><f>{early_parts}</f><v>0</v></c>')
            cells.append(f'<c r="E{row_r}" s="{sty_val}"><f>{day_parts}</f><v>0</v></c>')
            cells.append(f'<c r="F{row_r}" s="{sty_val}"><f>{late_parts}</f><v>0</v></c>')
        else:
            # 翌月分（別シートがないためマニュアル入力セル）
            cells.append(f'<c r="C{row_r}" s="{sty_val}"><v></v></c>')
            cells.append(f'<c r="D{row_r}" s="{sty_val}"><v></v></c>')
            cells.append(f'<c r="E{row_r}" s="{sty_val}"><v></v></c>')
            cells.append(f'<c r="F{row_r}" s="{sty_val}"><v></v></c>')

        cells.append(f'<c r="G{row_r}" s="14" t="s"><v>{ss.add("")}</v></c>')
        rows_xml.append(f'<row r="{row_r}">{"".join(cells)}</row>')

    last_data_row = 2 + len(period_days)

    merge_xml = f'<mergeCells count="1"><mergeCell ref="A1:G1"/></mergeCells>'

    col_defs = (
        '<col min="1" max="1" width="10" customWidth="1"/>'
        '<col min="2" max="2" width="6" customWidth="1"/>'
        '<col min="3" max="6" width="12" customWidth="1"/>'
        '<col min="7" max="7" width="20" customWidth="1"/>'
    )

    # グラフの描画領域（A列の右側 I2:R30 あたり）
    drawing_rel = '<drawing r:id="rId1"/>'

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>'
        f'<cols>{col_defs}</cols>'
        f'<sheetData>{"".join(rows_xml)}</sheetData>'
        f'{merge_xml}'
        f'{drawing_rel}'
        '</worksheet>'
    )
    return sheet_xml, len(period_days), last_data_row

# ============================================================
# Chart XML (棒グラフ: 積み上げ 早/日/遅)
# ============================================================
def build_chart_xml(num_period_days):
    last_row = 2 + num_period_days

    # 積み上げ棒グラフ: 早・日・遅の3系列
    series = []
    colors = ["4472C4", "ED7D31", "A9D18E"]
    labels = ["早番", "日勤", "遅番"]
    col_refs = ["D", "E", "F"]

    for i, (label, col, color) in enumerate(zip(labels, col_refs, colors)):
        series.append(f'''
        <c:ser>
          <c:idx val="{i}"/>
          <c:order val="{i}"/>
          <c:tx>
            <c:strRef>
              <c:f>グラフ!${col}$2</c:f>
              <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>{label}</c:v></c:pt></c:strCache>
            </c:strRef>
          </c:tx>
          <c:spPr>
            <a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:srgbClr val="{color}"/>
            </a:solidFill>
          </c:spPr>
          <c:cat>
            <c:strRef>
              <c:f>グラフ!$A$3:$A${last_row}</c:f>
              <c:strCache><c:ptCount val="{num_period_days}"/></c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>グラフ!${col}$3:${col}${last_row}</c:f>
              <c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="{num_period_days}"/></c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>''')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:lang val="ja-JP"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:t>シフト別出勤者数（11日〜翌10日）</a:t></a:r></a:p>
      </c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="stacked"/>
        <c:varyColors val="0"/>
        {"".join(series)}
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="1"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:crossAx val="2"/>
        <c:tickLblSkip val="1"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="2"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:title>
          <c:tx><c:rich><a:bodyPr rot="-5400000"/><a:lstStyle/>
            <a:p><a:r><a:t>人数</a:t></a:r></a:p>
          </c:rich></c:tx>
          <c:overlay val="0"/>
        </c:title>
        <c:crossAx val="1"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>'''

# ============================================================
# Drawing XML (グラフをシートに貼り付け)
# ============================================================
def build_drawing_xml():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor moveWithCells="1">
    <xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>20</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>32</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="グラフ 1"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>'''

# ============================================================
# Excel (xlsx) ファイル組立
# ============================================================
def build_xlsx(year, month, employees, output_path):
    ss = SharedStrings()

    # シート生成
    shift_xml, num_days, num_emps, total_row = build_shift_sheet(year, month, employees, ss)
    graph_xml, num_period, last_data_row     = build_graph_sheet(year, month, num_days, num_emps, total_row, ss)
    chart_xml   = build_chart_xml(num_period)
    drawing_xml = build_drawing_xml()

    # workbook.xml
    workbook_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView activeTab="0"/></bookViews>
  <sheets>
    <sheet name="シフト表" sheetId="1" r:id="rId1"/>
    <sheet name="グラフ"   sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>'''

    # _rels/workbook.xml.rels
    wb_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
    Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
    Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings"
    Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>'''

    # sheet2 の drawing rels
    sheet2_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"
    Target="../charts/chart1.xml"/>
</Relationships>'''

    # chart1 rels (空)
    chart_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'''

    # [Content_Types].xml
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/charts/chart1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
</Types>'''

    # _rels/.rels
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="xl/workbook.xml"/>
</Relationships>'''

    # ZIP に書き込み
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml",              content_types)
        zf.writestr("_rels/.rels",                      root_rels)
        zf.writestr("xl/workbook.xml",                  workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels",       wb_rels)
        zf.writestr("xl/worksheets/sheet1.xml",         shift_xml)
        zf.writestr("xl/worksheets/sheet2.xml",         graph_xml)
        zf.writestr("xl/worksheets/_rels/sheet2.xml.rels", sheet2_rels)
        zf.writestr("xl/drawings/drawing1.xml",         drawing_xml)
        zf.writestr("xl/charts/chart1.xml",             chart_xml)
        zf.writestr("xl/charts/_rels/chart1.xml.rels",  chart_rels)
        zf.writestr("xl/sharedStrings.xml",             ss.to_xml())
        zf.writestr("xl/styles.xml",                    styles_xml())

    print(f"✅ 生成完了: {output_path}")
    print(f"   対象月: {year}年{month}月")
    print(f"   従業員: {', '.join(employees)} ({len(employees)}名)")
    print(f"   グラフ期間: {month}月11日 〜 {(month%12)+1}月10日")

# ============================================================
# CLI エントリポイント
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="シフト表Excel生成")
    parser.add_argument("--year",  type=int, default=datetime.now().year,  help="年（デフォルト: 今年）")
    parser.add_argument("--month", type=int, default=datetime.now().month, help="月（デフォルト: 今月）")
    parser.add_argument("--employees", nargs="+", default=EMPLOYEES, help="従業員名リスト")
    parser.add_argument("--output", default=None, help="出力ファイル名")
    args = parser.parse_args()

    out = args.output or f"shift_{args.year}{args.month:02d}.xlsx"
    build_xlsx(args.year, args.month, args.employees, out)
