#!/usr/bin/env python3
"""シフト表をHTMLで出力（ブラウザで確認可能）"""

import calendar
from datetime import date, datetime
import argparse

EMPLOYEES = ["田中", "佐藤", "鈴木", "山田", "伊藤"]
WD = ["月","火","水","木","金","土","日"]

def build_html(year, month, employees):
    num_days = calendar.monthrange(year, month)[1]
    days = [date(year, month, d) for d in range(1, num_days + 1)]

    next_year  = year if month < 12 else year + 1
    next_month = month + 1 if month < 12 else 1

    # 11日〜翌10日の期間
    period = []
    for d in range(11, num_days + 1):
        period.append(date(year, month, d))
    for d in range(1, 11):
        try:
            period.append(date(next_year, next_month, d))
        except ValueError:
            pass

    # デフォルトシフト: 平日=日, 土日=休
    shifts = {}
    for emp in employees:
        for d in days:
            wd = d.weekday()
            shifts[(emp, d)] = "休" if wd >= 5 else "日"

    # ---- Sheet1 HTML ----
    s1_header = ""
    for d in days:
        wd = d.weekday()
        cls = "sat" if wd == 5 else ("sun" if wd == 6 else "")
        label = f"{d.day}<br><span class='wd'>{WD[wd]}</span>"
        s1_header += f'<th class="{cls}">{label}</th>'

    s1_rows = ""
    daily_counts = {d: 0 for d in days}
    emp_stats = {}

    for i, emp in enumerate(employees):
        row = f'<td class="no">{i+1}</td><td class="emp">{emp}</td>'
        early = day = late = 0
        for d in days:
            wd = d.weekday()
            sh = shifts[(emp, d)]
            cls = "sat" if wd == 5 else ("sun" if wd == 6 else "")
            sh_cls = {"早": "sh-early", "日": "sh-day", "遅": "sh-late", "休": "sh-off"}.get(sh, "")
            row += f'<td class="shift {cls} {sh_cls}">{sh}</td>'
            if sh == "早": early += 1
            elif sh == "日": day += 1
            elif sh == "遅": late += 1
            if sh in ("早","日","遅"):
                daily_counts[d] += 1
        work = early + day + late
        emp_stats[emp] = (early, day, late, work)
        row += f'<td class="stat">{early}</td><td class="stat">{late}</td><td class="stat">{work}</td>'
        s1_rows += f'<tr>{row}</tr>\n'

    # 日別合計行
    daily_row = '<td class="no"></td><td class="emp total-label">日別出勤数</td>'
    for d in days:
        wd = d.weekday()
        cls = "sat" if wd == 5 else ("sun" if wd == 6 else "")
        daily_row += f'<td class="shift {cls} total-cell">{daily_counts[d]}</td>'
    daily_row += '<td class="stat"></td><td class="stat"></td><td class="stat"></td>'

    # ---- Sheet2 グラフデータ ----
    period_rows = ""
    chart_labels = []
    chart_early = []
    chart_day   = []
    chart_late  = []
    chart_total = []

    for d in period:
        wd = d.weekday()
        cls = "sat" if wd == 5 else ("sun" if wd == 6 else "")
        label = f"{d.month}/{d.day}"
        chart_labels.append(label)
        if d.month == month and d.year == year:
            e = sum(1 for emp in employees if shifts[(emp,d)] == "早")
            dy= sum(1 for emp in employees if shifts[(emp,d)] == "日")
            l = sum(1 for emp in employees if shifts[(emp,d)] == "遅")
            total = e + dy + l
            period_rows += (
                f'<tr class="{cls}">'
                f'<td class="date-col">{label}</td>'
                f'<td>{WD[wd]}</td>'
                f'<td class="num">{total}</td>'
                f'<td class="num sh-early-bg">{e}</td>'
                f'<td class="num sh-day-bg">{dy}</td>'
                f'<td class="num sh-late-bg">{l}</td>'
                f'<td class="note-col"></td>'
                f'</tr>\n'
            )
            chart_early.append(e)
            chart_day.append(dy)
            chart_late.append(l)
            chart_total.append(total)
        else:
            period_rows += (
                f'<tr class="{cls}">'
                f'<td class="date-col">{label}</td>'
                f'<td>{WD[wd]}</td>'
                f'<td class="num manual">—</td>'
                f'<td class="num manual">—</td>'
                f'<td class="num manual">—</td>'
                f'<td class="num manual">—</td>'
                f'<td class="note-col"><span class="manual-note">翌月シート参照</span></td>'
                f'</tr>\n'
            )
            chart_early.append(0)
            chart_day.append(0)
            chart_late.append(0)
            chart_total.append(0)

    chart_labels_js = str(chart_labels)
    chart_early_js  = str(chart_early)
    chart_day_js    = str(chart_day)
    chart_late_js   = str(chart_late)

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{year}年{month}月 シフト表</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Segoe UI','游ゴシック',sans-serif; background:#f0f4f8; color:#1e293b; }}
.container {{ max-width:100%; padding:20px; }}
h1 {{ font-size:1.4rem; color:#1e40af; margin-bottom:6px; }}
h2 {{ font-size:1.1rem; color:#1e40af; margin:24px 0 8px; border-left:4px solid #2563eb; padding-left:10px; }}
.tab-bar {{ display:flex; gap:4px; margin-bottom:16px; }}
.tab {{ padding:8px 20px; background:#e2e8f0; border-radius:8px 8px 0 0; cursor:pointer;
        font-weight:600; color:#64748b; border:none; font-size:0.95rem; }}
.tab.active {{ background:#2563eb; color:#fff; }}
.panel {{ display:none; }} .panel.active {{ display:block; }}
.scroll-x {{ overflow-x:auto; }}
table {{ border-collapse:collapse; font-size:0.82rem; white-space:nowrap; }}
th,td {{ border:1px solid #cbd5e1; padding:5px 7px; text-align:center; }}
th {{ background:#2563eb; color:#fff; font-weight:600; }}
.emp {{ background:#dbeafe; font-weight:700; text-align:left; min-width:60px; }}
.no {{ background:#dbeafe; color:#64748b; width:34px; }}
.sat {{ background:#fef9c3; }}
.sun {{ background:#fee2e2; }}
th.sat {{ background:#ca8a04; color:#fff; }}
th.sun {{ background:#dc2626; color:#fff; }}
.shift {{ width:38px; cursor:pointer; }}
.sh-early {{ background:#bbf7d0; color:#065f46; font-weight:700; }}
.sh-day   {{ background:#bfdbfe; color:#1e40af; font-weight:700; }}
.sh-late  {{ background:#fde68a; color:#78350f; font-weight:700; }}
.sh-off   {{ color:#94a3b8; }}
.stat {{ background:#f1f5f9; font-weight:700; color:#0f172a; min-width:52px; }}
.total-label {{ background:#1e40af; color:#fff; text-align:left; font-weight:700; }}
.total-cell {{ background:#1e40af; color:#fff; font-weight:700; }}
/* グラフシート */
.period-table th {{ background:#2563eb; }}
.date-col {{ min-width:55px; }}
.note-col {{ min-width:100px; text-align:left; }}
.num {{ min-width:55px; }}
.sh-early-bg {{ background:#bbf7d0; color:#065f46; font-weight:700; }}
.sh-day-bg   {{ background:#bfdbfe; color:#1e40af; font-weight:700; }}
.sh-late-bg  {{ background:#fde68a; color:#78350f; font-weight:700; }}
.manual {{ color:#94a3b8; }}
.manual-note {{ font-size:0.75rem; color:#94a3b8; }}
.chart-wrap {{ margin-top:20px; background:#fff; border-radius:12px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,.1); }}
canvas {{ max-width:100%; }}
.legend {{ display:flex; gap:16px; margin:8px 0 16px; font-size:0.82rem; }}
.legend span {{ display:flex; align-items:center; gap:4px; }}
.dot {{ width:14px; height:14px; border-radius:3px; }}
.info {{ font-size:0.8rem; color:#64748b; margin:6px 0 12px; }}
</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
</head>
<body>
<div class="container">
<h1>📅 {year}年{month}月 シフト管理表</h1>
<p class="info">※ シフト欄をクリックすると 早→日→遅→休 と切り替わります（このページ内でのプレビューのみ）</p>
<div class="tab-bar">
  <button class="tab active" onclick="showTab('s1')">📋 シフト表</button>
  <button class="tab" onclick="showTab('s2')">📊 グラフ（11日〜翌10日）</button>
</div>

<!-- Sheet1 -->
<div id="s1" class="panel active">
<div class="scroll-x">
<table id="shift-table">
<thead>
<tr>
  <th>No</th><th>氏名</th>
  {s1_header}
  <th>早番</th><th>遅番</th><th>出勤日数</th>
</tr>
</thead>
<tbody>
{s1_rows}
<tr>{daily_row}</tr>
</tbody>
</table>
</div>
<div style="margin-top:10px;font-size:0.8rem;color:#64748b;">
  凡例：<span style="background:#bbf7d0;padding:2px 6px;border-radius:3px;">早</span> 早番 &nbsp;
        <span style="background:#bfdbfe;padding:2px 6px;border-radius:3px;">日</span> 日勤 &nbsp;
        <span style="background:#fde68a;padding:2px 6px;border-radius:3px;">遅</span> 遅番 &nbsp;
        <span style="background:#f1f5f9;padding:2px 6px;border-radius:3px;">休</span> 休み
</div>
</div>

<!-- Sheet2 -->
<div id="s2" class="panel">
<div class="chart-wrap">
  <h2 style="border:none;margin:0 0 8px;">シフト別出勤者数（{month}月11日 〜 {next_month}月10日）</h2>
  <div class="legend">
    <span><div class="dot" style="background:#34d399"></div>早番</span>
    <span><div class="dot" style="background:#60a5fa"></div>日勤</span>
    <span><div class="dot" style="background:#fbbf24"></div>遅番</span>
  </div>
  <canvas id="chart" height="120"></canvas>
</div>
<div class="scroll-x" style="margin-top:16px;">
<table class="period-table">
<thead>
<tr>
  <th>日付</th><th>曜日</th><th>出勤者数</th><th>早番</th><th>日勤</th><th>遅番</th><th>備考</th>
</tr>
</thead>
<tbody>
{period_rows}
</tbody>
</table>
</div>
</div>
</div>

<script>
function showTab(id) {{
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}}

// シフトをクリックで切り替え
const cycle = {{"早":"日","日":"遅","遅":"休","休":"早"}};
const styleMap = {{"早":"sh-early","日":"sh-day","遅":"sh-late","休":"sh-off"}};
document.querySelectorAll('.shift:not(.total-cell)').forEach(td => {{
  td.addEventListener('click', () => {{
    const cur = td.textContent.trim();
    const next = cycle[cur] || "日";
    td.textContent = next;
    Object.values(styleMap).forEach(c => td.classList.remove(c));
    td.classList.add(styleMap[next] || "");
  }});
}});

// Chart.js グラフ
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, {{
  type: 'bar',
  data: {{
    labels: {chart_labels_js},
    datasets: [
      {{ label:'早番', data:{chart_early_js}, backgroundColor:'#34d399', stack:'s' }},
      {{ label:'日勤', data:{chart_day_js},   backgroundColor:'#60a5fa', stack:'s' }},
      {{ label:'遅番', data:{chart_late_js},  backgroundColor:'#fbbf24', stack:'s' }},
    ]
  }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ display:false }} }},
    scales: {{
      x: {{ stacked:true, ticks:{{ font:{{ size:11 }} }} }},
      y: {{ stacked:true, beginAtZero:true, ticks:{{ stepSize:1 }} }}
    }}
  }}
}});
</script>
</body>
</html>"""
    return html


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year",  type=int, default=datetime.now().year)
    parser.add_argument("--month", type=int, default=datetime.now().month)
    parser.add_argument("--employees", nargs="+", default=EMPLOYEES)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    out = args.output or f"shift_{args.year}{args.month:02d}.html"
    html = build_html(args.year, args.month, args.employees)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ 生成完了: {out}")
