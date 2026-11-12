# 特典パック（xlsx / txt）を生成する
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from pathlib import Path
OUT = Path(__file__).parent / "pack"
CORAL, GREEN, SAND, INK = "E8735A", "2F6B5A", "F3E7D6", "2F2A26"
thin = Side(style="thin", color="D9CBB8"); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
INPUT = PatternFill("solid", fgColor="FFF7D6")

def sheet(wb, title, widths, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    return ws
def title(ws, text, sub=None):
    ws["A1"] = text; ws["A1"].font = Font(size=16, bold=True, color=INK)
    if sub: ws["A2"] = sub; ws["A2"].font = Font(size=10, color="6E645C")
def header(ws, row, cols, color=GREEN):
    for i, c in enumerate(cols, 1):
        x = ws.cell(row=row, column=i, value=c)
        x.font = Font(bold=True, color="FFFFFF"); x.fill = PatternFill("solid", fgColor=color)
        x.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); x.border = BORDER
    ws.row_dimensions[row].height = 30
def rows(ws, start, data, inputs=()):
    for r, line in enumerate(data, start):
        for c, v in enumerate(line, 1):
            x = ws.cell(row=r, column=c, value=v); x.border = BORDER
            x.alignment = Alignment(vertical="center", wrap_text=True)
            if c in inputs: x.fill = INPUT
    return start + len(data)
def note(ws, row, text, bold=False):
    ws.cell(row=row, column=1, value=text).font = Font(size=10, bold=bold, color=INK if bold else "6E645C")

# ---------- 01 定番リスト ----------
wb = Workbook()
ws = sheet(wb, "使い方", [100], True); title(ws, "特典1　定番リスト＆買わない物リスト")
for i, t in enumerate([
    "このファイルでやること：毎月の「買う物」と「買わない物」を先に決めて、買い回りの日に迷わないようにします。",
    "", "① 「定番リスト（記入例）」を見て、わが家に当てはまる物に目星をつける",
    "② 「定番リスト（記入用）」に、まず10品だけ書く（残りは次の買い回りまでに）",
    "③ 「買わない物リスト」の6行目に、自分が後悔した買い物を1つ足す",
    "④ 迷う物は「単価くらべ」に値段を入れる → 楽天か、お店かが自動で出ます",
    "", "黄色いセルが入力するところです。それ以外のセルには式が入っているので、さわらなくて大丈夫です。",
    "スマホで使う方は、Googleスプレッドシートのアプリで開くとそのまま編集できます。"], 3):
    ws.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True)

ws = sheet(wb, "定番リスト（記入例）", [14, 30, 22, 18, 14, 14, 30])
title(ws, "定番リスト（記入例）", "子育て4人家族の例です。銘柄・容量・お店まで決めるのがコツ")
header(ws, 4, ["分類", "買う物", "容量・入数", "買うお店", "買う箱", "頻度", "メモ"])
ex = [
 ["紙・衛生","トイレットペーパー","12ロール×6パック","日用品店A","楽天","2か月に1回","1ロール単価で比べる"],
 ["紙・衛生","ティッシュ","5箱×12パック","日用品店A","楽天","3か月に1回",""],
 ["紙・衛生","おむつ","Lサイズ 1箱","ベビー用品店","楽天","月1回","サイズ替えの月は1箱だけ"],
 ["紙・衛生","おしりふき","80枚×16個","ベビー用品店","楽天","2か月に1回",""],
 ["紙・衛生","生理用品","まとめ買いセット","日用品店A","楽天","3か月に1回",""],
 ["洗う・掃除","洗濯洗剤 詰め替え","特大サイズ×2","日用品店A","楽天","2か月に1回",""],
 ["洗う・掃除","柔軟剤・漂白剤","詰め替え×2","日用品店A","楽天","3か月に1回",""],
 ["洗う・掃除","食器用洗剤","詰め替え大","日用品店A","楽天","3か月に1回",""],
 ["洗う・掃除","シャンプー・ボディソープ","詰め替え×各2","日用品店A","楽天","2か月に1回",""],
 ["洗う・掃除","ゴミ袋・ラップ・保存袋","各まとめ買い","日用品店A","楽天","3か月に1回",""],
 ["食品（常温）","お米","10kg","お米のお店","楽天","月1回","5kg×2だと保管しやすい"],
 ["食品（常温）","水","2L×9本","飲料のお店","楽天","月1回",""],
 ["食品（常温）","お茶","500ml×24本","飲料のお店","楽天","2か月に1回",""],
 ["食品（常温）","麦茶パック・コーヒー","大容量","食品のお店","楽天","3か月に1回",""],
 ["食品（常温）","パスタ・乾麺・レトルト","まとめ買い","食品のお店","楽天","2か月に1回",""],
 ["食品（常温）","しょうゆ・油・だし","大容量","食品のお店","楽天","3か月に1回",""],
 ["食品（常温）","子どものおやつ","箱買い","食品のお店","楽天","月1回","買いすぎ注意。1箱まで"],
 ["子ども・他","肌着・くつ下","3枚組など","衣料品店","楽天","季節ごと","サイズアウト前に"],
 ["子ども・他","文具の補充","ノート・鉛筆・のり","文具店","楽天","学期ごと",""],
 ["子ども・他","化粧水・日焼け止め","いつもの銘柄","ドラッグストア","お店","2か月に1回","ポイントの多い日に"],
 ["生鮮","肉・魚・野菜・卵・牛乳・パン","―","近所のスーパー","お店","週2回","買い物は週2回までに"],
 ["生鮮","冷凍食品","―","スーパーの特売日","お店","月2回",""],
]
end = rows(ws, 5, ex); ws.freeze_panes = "A5"

ws = sheet(wb, "定番リスト（記入用）", [14, 30, 22, 18, 14, 14, 30])
title(ws, "わが家の定番リスト（記入用）", "まずは10品。黄色いところに書きこみます")
header(ws, 4, ["分類", "買う物", "容量・入数", "買うお店", "買う箱（楽天／お店）", "頻度", "メモ"])
rows(ws, 5, [[""]*7 for _ in range(25)], inputs=range(1, 8)); ws.freeze_panes = "A5"
note(ws, 31, "楽天向きの4条件：①重い・かさばる ②毎月かならず使う ③銘柄が決まっている ④腐らない（2つ以上当てはまれば楽天）")

ws = sheet(wb, "買わない物リスト", [6, 46, 50])
title(ws, "買わない物リスト", "買い回りの日に、かならず目に入る場所に置いておきます")
header(ws, 4, ["No.", "買わない物", "なぜ買わないか"], CORAL)
rows(ws, 5, [
 [1,"店舗数を増やすためだけの1,000円商品","1店舗ふえても増えるのは約300ポイント。700円の損"],
 [2,"使ったことのない物のまとめ買い","合わなかったとき、全部がムダになる"],
 [3,"「いつか使う」収納グッズ・便利グッズ","いつかは来ないことが多い"],
 [4,"子どもが欲しがっていないおもちゃ・教材","親の安心のための買い物になりやすい"],
 [5,"送料無料に届かせるための買い足し","送料より高い買い足しになる"],
 [6,"",""],[7,"",""],[8,"",""]], inputs=())
for r in (10, 11, 12):
    for c in (2, 3): ws.cell(row=r, column=c).fill = INPUT
note(ws, 14, "【2問フィルター】定番以外の物が欲しくなったら", True)
note(ws, 15, "問い1：これは、来月買う予定だった物？")
note(ws, 16, "問い2：いま買って、置く場所はある？")
note(ws, 17, "→ 両方「はい」なら買ってOK。どちらかが「いいえ」なら、お気に入りに入れて今回は見送り。")

ws = sheet(wb, "単価くらべ", [24, 12, 10, 12, 12, 10, 10, 12, 12, 14, 12])
title(ws, "単価くらべ（実質の値段で判定）", "黄色いセルに値段と入数を入れると、楽天とお店のどちらが安いかが出ます")
ws["A3"] = "ポイント還元の目安（%）"; ws["B3"] = 8; ws["B3"].fill = INPUT
ws["C3"] = "← 楽天カード＋買い回り4〜5店舗なら7〜10が目安"; ws["C3"].font = Font(size=10, color="6E645C")
header(ws, 5, ["商品", "お店の値段", "お店の入数", "お店の単価", "楽天の値段", "送料", "楽天の入数", "もらえるポイント", "楽天の実質", "楽天の実質単価", "判定"])
sample = [["トイレットペーパー（1ロール）", 418, 12, 2680, 0, 72], ["洗濯洗剤 詰め替え（1袋）", 398, 1, 1480, 0, 4], ["お米（1kg）", 4280, 10, 4480, 0, 10]]
for i in range(15):
    r = 6 + i; s = sample[i] if i < len(sample) else ["", None, None, None, None, None]
    vals = [s[0], s[1], s[2], f'=IF(AND(B{r}<>"",C{r}<>""),B{r}/C{r},"")', s[3], s[4], s[5],
            f'=IF(E{r}<>"",ROUND(E{r}*$B$3/100,0),"")', f'=IF(E{r}<>"",E{r}+F{r}-H{r},"")',
            f'=IF(AND(E{r}<>"",G{r}<>""),I{r}/G{r},"")', f'=IF(OR(D{r}="",J{r}=""),"",IF(J{r}<=D{r},"楽天","お店"))']
    for c, v in enumerate(vals, 1):
        x = ws.cell(row=r, column=c, value=v); x.border = BORDER
        if c in (1, 2, 3, 5, 6, 7): x.fill = INPUT
        if c in (4, 10): x.number_format = "0.0"
note(ws, 22, "※ 2週間以内に必要な物は、値段にかかわらず「お店」で。重い・かさばる物は、少し高くても「楽天」で構いません。")
ws.freeze_panes = "B6"
wb.save(OUT / "01_定番リスト＆買わない物リスト.xlsx")

# ---------- 02 買い回り計画 ----------
wb = Workbook()
ws = sheet(wb, "適正店舗数の計算", [26, 16, 18, 22, 22], True)
title(ws, "特典2　わが家の「ちょうどいい店舗数」計算シート", "黄色いセルに、1回の買い回りで買う金額を入れてください")
ws["A4"] = "1回の買い回りの買い物額（円）"; ws["B4"] = 30000; ws["B4"].fill = INPUT; ws["B4"].number_format = "#,##0"
ws["A5"] = "いらない物1個の値段（円）"; ws["B5"] = 1000; ws["B5"].fill = INPUT; ws["B5"].number_format = "#,##0"
header(ws, 7, ["店舗数", "上乗せ倍率", "増えるポイント", "前の店舗数より増える分", "いらない物で1店舗足した損得"])
for i, n in enumerate(range(2, 11)):
    r = 8 + i
    vals = [n, f"=A{r}-1", f"=ROUND($B$4*B{r}/100,0)", f"=C{r}-IF(A{r}=2,0,C{r-1})" if i else f"=C{r}", f"=D{r}-$B$5"]
    for c, v in enumerate(vals, 1):
        x = ws.cell(row=r, column=c, value=v); x.border = BORDER; x.alignment = Alignment(horizontal="center")
        if c == 2: x.number_format = '"+"0"%"'
        if c >= 3: x.number_format = '#,##0;[Red]-#,##0'
note(ws, 18, "見かた：右はしの列がマイナスなら、いらない物で店舗数を増やすと損です。", True)
note(ws, 19, "定番リストだけで自然にうまる店舗数（多くの家庭で4〜6）が、いちばんお金が残ります。")
note(ws, 20, "※ 買い回りのポイントには上限があります（7,000ポイントの回が多い）。倍率・上限は開催回のページで確認してください。")

ws = sheet(wb, "年間カレンダー", [8, 36, 14, 12, 16, 16, 30])
title(ws, "買い回り年間カレンダー", "定番以外に買う「大きな買い物」を、必要になる1か月前の月に置きます")
header(ws, 4, ["月", "定番以外に買う物（1〜3つ）", "買う日", "店舗数", "買い物額（円）", "増えるポイント", "メモ"])
cal = [["1月","（SPUの条件を年1回だけ確認）"],["2月","花粉の季節の物"],["3月","新学期の準備（上履き・文具・水筒）／春夏の肌着"],["4月",""],
 ["5月","母の日・父の日のギフト／日焼け止め・虫よけ"],["6月","夏の物（水着・扇風機）"],["7月","お中元／夏休みの自由研究・レジャー用品"],["8月",""],
 ["9月","秋冬の肌着／運動会・遠足の物"],["10月","冬の寝具・加湿器"],["11月","クリスマスプレゼント／お歳暮"],["12月","お年賀・大掃除の道具"]]
for i, (m, t) in enumerate(cal):
    r = 5 + i; memo = "★点検の月" if m in ("3月", "6月", "9月", "12月") else ""
    vals = [m, t, "", "", "", f'=IF(AND(D{r}<>"",E{r}<>""),ROUND(E{r}*(D{r}-1)/100,0),"")', memo]
    for c, v in enumerate(vals, 1):
        x = ws.cell(row=r, column=c, value=v); x.border = BORDER; x.alignment = Alignment(vertical="center", wrap_text=True)
        if c in (2, 3, 4, 5): x.fill = INPUT
        if c in (5, 6): x.number_format = "#,##0"
    ws.row_dimensions[r].height = 34
ws["D17"] = "年間合計"; ws["E17"] = "=SUM(E5:E16)"; ws["F17"] = "=SUM(F5:F16)"
for c in "DEF": ws[f"{c}17"].font = Font(bold=True); ws[f"{c}17"].number_format = "#,##0"; ws[f"{c}17"].border = BORDER
note(ws, 19, "※ セールの開催日は毎回変わります。月の初めに一度だけ日程を確認して「買う日」を入れてください（5か0のつく日がおすすめ）。")
note(ws, 20, "※ 「増えるポイント」は買い回り分だけの目安です。")

ws = sheet(wb, "当日90分チェック", [6, 62, 10, 10])
title(ws, "月1回90分の買い回りチェックリスト", "判断は前日にすませる。当日は作業だけ")
header(ws, 4, ["", "前日（15分）", "目安", "できた"])
r = rows(ws, 5, [[1,"在庫写真を見て、○と△の物を確認する","3分",""],[2,"お気に入りから、今月買う定番をカートに入れる","7分",""],
 [3,"カートの合計を見て、予算内か確認する","3分",""],[4,"定番以外が入っていたら、2問フィルターを通す","2分",""]], inputs=(4,))
header(ws, r + 1, ["", "当日（75分）※昼か夕食前に。夜10時以降は買わない", "目安", "できた"], CORAL)
rows(ws, r + 2, [[1,"買い回りと「5と0のつく日」にエントリーする","5分",""],[2,"カートのお店ごとにクーポンを確認する","20分",""],
 [3,"クーポン後の金額が1,000円を切っていないか確認する","5分",""],[4,"お店ごとに購入する","30分",""],
 [5,"買った金額と店舗数をメモする","5分",""],[6,"アプリを閉じて、お茶を飲む","10分",""]], inputs=(4,))
wb.save(OUT / "02_買い回り計画シート.xlsx")

# ---------- 03 月じまい ----------
wb = Workbook()
ws = sheet(wb, "月じまいシート", [10, 14, 10, 14, 10, 14, 10, 14, 14, 14, 16, 16, 34], True)
title(ws, "特典3　月じまい・振り返りシート", "給料日の翌日に、1行だけ書きます（15分）。黄色いセルが入力するところです")
header(ws, 4, ["月", "箱A 楽天（円）", "店舗数", "箱B お店（円）", "回数", "箱C 急ぎ（円）", "回数", "入ったポイント", "移した額（円）", "支出の合計", "スタート時との差", "移した額の累計", "来月の調整（1つだけ）"])
labels = ["スタート時"] + [f"{i}か月目" for i in range(1, 13)]
for i, lab in enumerate(labels):
    r = 5 + i
    vals = [lab, None, None, None, None, None, None, None, None,
            f'=IF(COUNT(B{r},D{r},F{r})=0,"",SUM(B{r},D{r},F{r}))',
            "" if i == 0 else f'=IF(OR(J{r}="",$J$5=""),"",J{r}-$J$5)',
            "" if i == 0 else f'=IF(I{r}="","",SUM($I$6:I{r}))', ""]
    if i == 0: vals[1:7] = [18000, None, 92000, 22, 11000, 14]
    for c, v in enumerate(vals, 1):
        x = ws.cell(row=r, column=c, value=v); x.border = BORDER
        if c in (2, 3, 4, 5, 6, 7, 8, 9, 13) and not (i == 0 and c in (3, 8, 9, 13)): x.fill = INPUT
        if c in (2, 4, 6, 8, 9, 10, 12): x.number_format = "#,##0"
        if c == 11: x.number_format = '#,##0;[Red]-#,##0'
    ws.row_dimensions[r].height = 26
ws["H18"] = "=SUM(H6:H17)"; ws["I18"] = "=SUM(I6:I17)"; ws["G18"] = "1年の合計"
for c in "GHI": ws[f"{c}18"].font = Font(bold=True); ws[f"{c}18"].number_format = "#,##0"; ws[f"{c}18"].border = BORDER
note(ws, 20, "書き方のコツ", True)
note(ws, 21, "・スタート時の行は記入例です。第2章で出した、わが家の「3つの箱」の数字に書きかえてください。")
note(ws, 22, "・良い悪いはつけません。数字を並べるだけ。予算を超えた月も、翌月に取り返そうとしないで「ふつうに戻す」。")
note(ws, 23, "・移した額 ＝ その月にポイントで払った額 ＋ 「急ぎの箱」が減った額（細かく出せない月は、先月と同じ額で大丈夫です）")
ws.freeze_panes = "B5"

ws = sheet(wb, "年4回の点検", [6, 60, 12, 12, 12, 12])
title(ws, "年4回の点検チェック", "3月・6月・9月・12月の月じまいのときに、5分だけ")
header(ws, 4, ["", "点検すること", "3月", "6月", "9月", "12月"])
rows(ws, 5, [[1,"定番リストに、もう使っていない物は無いか","","","",""],[2,"新しく毎月買うようになった物は無いか","","","",""],
 [3,"定番の値段が、大きく変わっていないか","","","",""],[4,"買わない物リストに、足したい物は無いか","","","",""],
 [5,"次の3か月の大きな買い物を、カレンダーに置いたか","","","",""]], inputs=(3, 4, 5, 6))

ws = sheet(wb, "夫へのひと言", [100])
title(ws, "夫に伝えるひと言メモ", "お願いも指摘もしない。報告だけ")
for i, t in enumerate(["【毎月の報告】「今月、買い方を変えた分で（　　　　）円、別の口座に移せたよ」",
 "　→「だからあなたも」とは続けません。反応が「ふーん」でも、それで大丈夫です。", "",
 "【3か月たったら】「（　　）万円たまったから、（　　　　　　）に出かけない？」",
 "　→ 節約の話より、楽しい使い道の話のほうが届きます。", "",
 "【支出が気になるとき】「飲み物、箱で買って冷蔵庫に入れておくね」",
 "　→ 相手の行動を止めるのではなく、こちらの持ち場に引き取ります。"], 4):
    ws.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True)
wb.save(OUT / "03_月じまい・振り返りシート.xlsx")
print("xlsx ok")
