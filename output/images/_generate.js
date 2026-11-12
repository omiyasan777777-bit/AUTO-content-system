const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const F = path.join(__dirname, 'node_modules/@fontsource/noto-sans-jp/files');
const b64 = w => fs.readFileSync(path.join(F, `noto-sans-jp-japanese-${w}-normal.woff2`)).toString('base64');
const css = `
${[400, 700, 900].map(w => `@font-face{font-family:NS;font-weight:${w};src:url(data:font/woff2;base64,${b64(w)}) format('woff2');}`).join('')}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:NS,'IPAPGothic',sans-serif;color:#2F2A26;background:#fff}
.fig{width:1200px;padding:56px 60px 48px;background:#FBF6EE}
.kicker{font-size:22px;font-weight:700;color:#E8735A;letter-spacing:.08em;margin-bottom:10px}
h1{font-size:44px;font-weight:900;line-height:1.35;margin-bottom:12px}
.sub{font-size:24px;color:#6E645C;line-height:1.6;margin-bottom:32px}
.row{display:flex;gap:24px;align-items:stretch}
.card{flex:1;background:#fff;border-radius:20px;padding:28px 28px;border:2px solid #EADCC8}
.card h2{font-size:30px;font-weight:900;margin-bottom:12px;line-height:1.35}
.card p,.card li{font-size:23px;line-height:1.7;color:#4A423C}
.card ul{list-style:none}
.card li{padding:9px 0;border-bottom:1px dashed #EADCC8}
.card li:last-child{border-bottom:none}
.coral{color:#E8735A}.green{color:#2F6B5A}
.bgc{background:#E8735A;color:#fff;border-color:#E8735A}
.bgg{background:#2F6B5A;color:#fff;border-color:#2F6B5A}
.bgc p,.bgg p,.bgc li,.bgg li{color:#fff}
.bgs{background:#F3E7D6}
.num{font-size:64px;font-weight:900;line-height:1.1}
.num small{font-size:26px;font-weight:700}
.badge{display:inline-block;font-size:20px;font-weight:700;padding:5px 16px;border-radius:999px;background:#2F6B5A;color:#fff;margin-bottom:12px}
.badge.c{background:#E8735A}
.badge.g{background:#B9AEA3}
.arrow{align-self:center;font-size:44px;color:#E8735A;font-weight:900;flex:0 0 auto}
.down{text-align:center;font-size:40px;color:#E8735A;font-weight:900;margin:10px 0}
.note{font-size:18px;color:#8A7F76;margin-top:22px;line-height:1.6}
.big{font-size:30px;font-weight:900;line-height:1.5;text-align:center;margin-top:28px;padding:22px;border-radius:18px;background:#fff;border:3px solid #E8735A}
.bar{display:flex;align-items:center;margin:14px 0}
.bar .lab{width:300px;font-size:24px;font-weight:700}
.bar .b{height:48px;border-radius:0 10px 10px 0;background:#2F6B5A}
.bar .b.c{background:#E8735A}
.bar .v{font-size:28px;font-weight:900;margin-left:16px;white-space:nowrap}
.mt{margin-top:24px}
.center{text-align:center}
.step{flex:1;background:#fff;border-radius:18px;padding:22px 20px;border:2px solid #EADCC8;text-align:center}
.step .n{font-size:20px;font-weight:900;color:#E8735A;letter-spacing:.06em}
.step h3{font-size:26px;font-weight:900;margin:6px 0 8px;line-height:1.35}
.step p{font-size:20px;color:#5A514A;line-height:1.55}
.group{border:3px dashed #E8735A;border-radius:24px;padding:38px 16px 16px;position:relative;flex:3;display:flex;gap:16px}
.group .gl{position:absolute;top:-18px;left:24px;background:#E8735A;color:#fff;font-weight:900;font-size:20px;padding:4px 18px;border-radius:999px}
.q{background:#fff;border:3px solid #2F6B5A;border-radius:18px;padding:20px 26px;font-size:27px;font-weight:900;text-align:center}
.yn{display:flex;gap:24px;margin-top:10px}
.yn>div{flex:1;text-align:center;font-size:22px;font-weight:700}
.tl{display:flex;gap:0;align-items:stretch}
.tl .t{flex:1;padding:20px 18px;background:#fff;border:2px solid #EADCC8;border-left:none}
.tl .t:first-child{border-left:2px solid #EADCC8;border-radius:16px 0 0 16px}
.tl .t:last-child{border-radius:0 16px 16px 0}
.tl .t b{display:block;font-size:22px;color:#E8735A;margin-bottom:6px}
.tl .t span{font-size:21px;line-height:1.55;color:#4A423C;display:block}
.lbl{font-size:26px;font-weight:900;margin:22px 0 12px}
`;
const fig = (kicker, title, sub, body, note) => `<div class="fig">${kicker ? `<div class="kicker">${kicker}</div>` : ''}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}${body}${note ? `<div class="note">${note}</div>` : ''}</div>`;
const li = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
const bar = (lab, v, max, cls, txt) => `<div class="bar"><div class="lab">${lab}</div><div class="b ${cls || ''}" style="width:${Math.round(v / max * 560)}px"></div><div class="v">${txt}</div></div>`;

const shops = fig('買い回りの本当の計算', '店舗数を増やしても、<br>増えるのは1店舗 <span class="coral">300ポイント</span>', '月に3万円を楽天で買う家庭の場合（増えるポイント＝買い物額×（店舗数−1）%）',
  bar('3店舗', 600, 2700, '', '600ポイント') + bar('5店舗', 1200, 2700, '', '1,200ポイント') + bar('7店舗', 1800, 2700, '', '1,800ポイント') + bar('10店舗', 2700, 2700, '', '2,700ポイント') +
  `<div class="row mt"><div class="card bgs"><span class="badge g">いらない物で1店舗ふやすと</span><p>もらえる：<b>＋300ポイント</b><br>払うお金：<b>−1,000円</b></p><div class="num coral mt">−700<small>円</small></div></div><div class="card bgs"><span class="badge g">5→10店舗をいらない物で埋めると</span><p>もらえる：<b>＋1,500ポイント</b><br>払うお金：<b>−5,000円以上</b></p><div class="num coral mt">−3,500<small>円</small></div></div></div>
  <div class="big">定番だけで自然にうまる <span class="green">4〜6店舗</span> が、いちばん残る</div>`,
  '※ポイントは目安。倍率・上限は開催回によって変わります');

const breakdown = fig('毎月残るお金の内訳', '毎月 <span class="coral">約3.3万円</span> が残る内訳', 'ポイントそのものは全体の4分の1。残りは「買い方の固定」で出ていかなくなったお金',
  bar('ポイントで払えた食費', 8300, 8300, 'c', '約8,300円') + bar('ついで買いが減った分', 8000, 8300, '', '約8,000円') + bar('急ぎの買い物が減った分', 7000, 8300, '', '約7,000円') + bar('店舗かせぎ・買い足しゼロ', 6000, 8300, '', '約6,000円') + bar('買う場所を見直した分', 3700, 8300, '', '約3,700円') +
  `<div class="row mt"><div class="card bgc center"><p>ポイント</p><div class="num">約1/4</div></div><div class="card bgg center"><p>買い方の固定</p><div class="num">約3/4</div></div></div>`,
  '※金額は目安です。ご家庭の買い物の量によって変わります');

const figs = {
  s1_cover: `<div class="fig" style="padding:72px 64px"><div class="kicker">夫が家計に無関心でも、ひとりで回る</div><h1 style="font-size:60px">30日でつくる<br>「毎月<span class="coral">3.3万円</span>残る家計」</h1><div class="sub" style="font-size:28px">楽天・持ち場家計の設計図</div><div class="row"><div class="card center"><span class="badge">固定①</span><h2>買う物</h2><p>定番20と<br>買わない物リスト</p></div><div class="card center"><span class="badge">固定②</span><h2>買う日</h2><p>月1回90分の<br>完走しない買い回り</p></div><div class="card center"><span class="badge">固定③</span><h2>ポイントの出口</h2><p>食費に流して<br>現金を先に移す</p></div></div><div class="big">家計簿ゼロ・我慢ゼロ・月1回90分だけ</div></div>`,
  s2_gap: fig('同じ物価、同じ暮らしでも', '1年で、これだけ差がつきます', '',
    `<div class="row"><div class="card bgs"><span class="badge g">何も変えない場合</span><h2>食費が1年で</h2><div class="num">＋約13<small>万円</small></div><p class="mt">4人世帯の食費は月約10.3万円。<br>前年より月約1.1万円増えています。</p></div><div class="card"><span class="badge c">買い方を整えた場合</span><h2>1年で残るお金</h2><div class="num coral">約40<small>万円</small></div><p class="mt">月に約3.3万円。<br>年間ポイントは約10万ポイント。</p></div></div><div class="big">差を生むのは知識の量ではなく<span class="coral">「先に決めているかどうか」</span></div>`,
    '出典：総務省 家計調査（2025年）／公開されている実践例の平均値。金額は目安です'),
  s3_compare: fig('節約には2種類ある', '「我慢する節約」と<br>「買い方を変える節約」', '',
    `<div class="row"><div class="card bgs"><span class="badge g">我慢する節約</span>${li(['買わない・あきらめる', '意志の強さが必要', '疲れると反動で買ってしまう', '家族も窮屈になる', '続かない'])}</div><div class="arrow">→</div><div class="card"><span class="badge c">買い方を変える節約</span>${li(['<b>どうせ買う物</b>の買い方を変える', '先に決めるので意志がいらない', '支出は同じ、ポイントだけ増える', '生活は何も変わらない', '<b>忙しい月でも崩れない</b>'])}</div></div>`),
  s4_beforeafter: fig('わが家の変化', 'ビフォー → アフター', '',
    `<div class="row"><div class="card bgs"><span class="badge g">以前</span>${li(['買い回りは毎晩スマホ', '「あと1店舗」で不要品', '買い物は月22回', 'ポイントを失効', '家計簿は3回挫折', '月末は残らない'])}</div><div class="arrow">→</div><div class="card"><span class="badge c">いま</span>${li(['買い回りは<b>月1回90分</b>', '予定に無い買い物<b>ほぼゼロ</b>', '買い物は<b>月12回</b>', '失効ポイント<b>ゼロ</b>', '月1回15分の確認だけ', '<b>毎月 約3.3万円が残る</b>'])}</div></div>`,
    '※数値は目安です'),
  s5_three: fig('ひとり完結・持ち場家計メソッド', '固定するのは、この3つだけ', '',
    `<div class="row"><div class="card center"><span class="badge">固定①</span><h2>買う物</h2><p>毎月の定番を決める<br>買わない物も決める</p></div><div class="arrow">＋</div><div class="card center"><span class="badge">固定②</span><h2>買う日</h2><p>月1回の買い回りに<br>買い物を寄せる</p></div><div class="arrow">＋</div><div class="card center"><span class="badge">固定③</span><h2>出口</h2><p>ポイントは食費へ<br>浮いた現金は別口座へ</p></div></div><div class="down">▼</div><div class="card bgc center"><h2 style="margin:0">その場で判断する回数が減る ＝ お金が残る</h2></div>`),
  s6_shops: shops,
  s7_filter: fig('買いすぎを止める', '2問フィルター', '定番以外の物が欲しくなったら、買う前にこの2つだけ',
    `<div class="q">問い1：これは、来月買う予定だった物？</div><div class="yn"><div class="green">はい ▼</div><div class="coral">いいえ → 今回は見送る</div></div><div class="q mt">問い2：いま買って、置く場所はある？</div><div class="yn"><div class="green">はい ▼</div><div class="coral">いいえ → 今回は見送る</div></div><div class="row mt"><div class="card bgg center"><h2 style="margin:0">買ってOK</h2><p>来月の買い物を前に<br>持ってきただけ</p></div><div class="card bgs center"><h2 style="margin:0">お気に入りへ</h2><p>来月も欲しければ<br>「予定の買い物」</p></div></div>`),
  s8_breakdown: breakdown,
  s9_future: fig('1年後のちがい', '何もしない1年／仕組みがある1年', '',
    `<div class="lbl">何もしない場合</div><div class="tl"><div class="t"><b>1か月後</b><span>また「あと1店舗」で迷う</span></div><div class="t"><b>半年後</b><span>物価は上がり、残るお金は減る</span></div><div class="t"><b>1年後</b><span>約40万円分の差がついている</span></div></div><div class="lbl coral">3つを固定した場合</div><div class="tl"><div class="t" style="border-color:#E8735A"><b>1か月後</b><span>買い回りが90分で終わる</span></div><div class="t" style="border-color:#E8735A"><b>3か月後</b><span>通帳に「残った」が見える</span></div><div class="t" style="border-color:#E8735A"><b>半年後</b><span>浮いたお金で家族とお出かけ</span></div></div>`,
    '※金額は目安です'),
  s10_roadmap: fig('30日で仕組みが完成', '30日ロードマップ', '1日の作業は長くても30分。おやすみの日も入っています',
    `<div class="row"><div class="step"><div class="n">1週目</div><h3>見える化する</h3><p>在庫を撮る<br>明細を3箱に</p></div><div class="arrow">→</div><div class="step"><div class="n">2週目</div><h3>買う物を固定</h3><p>定番リスト<br>買わない物</p></div><div class="arrow">→</div><div class="step"><div class="n">3週目</div><h3>買う日を固定</h3><p>前日15分<br>＋当日75分</p></div><div class="arrow">→</div><div class="step"><div class="n">4週目</div><h3>出口を固定</h3><p>ポイント払い<br>残す口座へ</p></div></div><div class="big">30日目：<span class="coral">考えなくても回る家計</span>が手元に</div>`),
  s11_leaks: fig('残らない家計の正体', 'お金が漏れていた3つの穴', 'どれも、ぜいたくではありません。その場で判断していただけ',
    `<div class="row"><div class="card"><span class="badge c">穴1</span><h2>お得だから<br>買った物</h2><p>半額・10倍・<br>あと1店舗</p></div><div class="card"><span class="badge c">穴2</span><h2>切らして慌てて<br>買った物</h2><p>1回800円×月14回<br>＝1万円超</p></div><div class="card"><span class="badge c">穴3</span><h2>使わずに<br>消えたポイント</h2><p>期間限定ポイント<br>の失効</p></div></div><div class="down">▼</div><div class="card bgg center"><h2 style="margin:0">先に決めてしまえば、穴はふさがる</h2></div>`),
  p1_map: fig('持ち場の設計図', '全体マップ：5つのSTEP', '',
    `<div class="row" style="align-items:stretch"><div class="step" style="flex:1"><div class="n">STEP1</div><h3>見える化</h3><p>持ち場の線<br>在庫・3つの箱</p></div><div class="arrow">→</div><div class="group"><div class="gl">3つの固定</div><div class="step"><div class="n">STEP2</div><h3>買う物</h3><p>定番<br>20品</p></div><div class="step"><div class="n">STEP3</div><h3>買う日</h3><p>月1回<br>90分</p></div><div class="step"><div class="n">STEP4</div><h3>出口</h3><p>食費へ<br>先に移す</p></div></div><div class="arrow">→</div><div class="step" style="flex:1"><div class="n">STEP5</div><h3>月じまい</h3><p>月1回15分<br>年4回点検</p></div></div><div class="big">ゴール：毎月 <span class="coral">約3.3万円</span> が残る仕組み</div>`),
  p2_boxes: fig('STEP1 見える化', '3つの箱と、お金の移し方', '我慢して減らすのではなく、置き場所を変える',
    `<div class="row"><div class="card center"><span class="badge">箱A</span><h2>楽天</h2><p>記入例：月18,000円<br>&nbsp;</p><p class="green mt"><b>定番をここへ寄せる</b></p></div><div class="arrow">←</div><div class="card center"><span class="badge g">箱B</span><h2>お店</h2><p>記入例：月92,000円<br>（22回）</p><p class="mt"><b>重い物・常温の物を移す</b></p></div><div class="card center bgs"><span class="badge c">箱C</span><h2>急ぎ</h2><p>記入例：月11,000円<br>（14回）</p><p class="coral mt"><b>できるだけ空っぽに</b></p></div></div><div class="big">見るのは「月額」と「回数」だけ。中身は見なくていい</div>`),
  p3_flow: fig('STEP2 買う物を固定する', '楽天・お店・急ぎの振り分けフロー', '定番リストの物だけ、一度だけ判定します',
    `<div class="q">① 2週間以内に必要？</div><div class="yn"><div class="coral">はい → お店で買う</div><div class="green">いいえ ▼</div></div><div class="q mt">② 重い・かさばる？</div><div class="yn"><div class="green">はい → 楽天</div><div>いいえ ▼</div></div><div class="q mt">③ 実質の値段は、お店と同じか安い？</div><div class="yn"><div class="green">はい → 楽天</div><div class="coral">いいえ → お店</div></div><div class="big" style="font-size:26px">実質の値段 ＝ 商品の値段 ＋ 送料 − もらえるポイント（目安7〜10%）</div>`),
  p4_shops: shops,
  p5_timeline: fig('STEP3 買う日を固定する', '月1回90分の買い回り', '判断は前日にすませる。当日は作業だけ',
    `<div class="lbl">前日　15分</div><div class="tl"><div class="t"><b>3分</b><span>在庫写真を確認</span></div><div class="t"><b>7分</b><span>定番をカートへ</span></div><div class="t"><b>3分</b><span>合計が予算内か</span></div><div class="t"><b>2分</b><span>2問フィルター</span></div></div><div class="lbl coral">当日　75分（5か0のつく日・昼か夕食前）</div><div class="tl"><div class="t"><b>5分</b><span>エントリー</span></div><div class="t"><b>20分</b><span>クーポン</span></div><div class="t"><b>5分</b><span>千円判定</span></div><div class="t"><b>30分</b><span>順に購入</span></div><div class="t"><b>5分</b><span>金額をメモ</span></div><div class="t"><b>10分</b><span>閉じてお茶</span></div></div><div class="big">夜10時以降は買わない</div>`),
  p6_exit: fig('STEP4 出口を固定する', 'ポイントの出口マップ', '貯めるのではなく、流す',
    `<div class="row"><div class="step"><div class="n">入口</div><h3>買い回りの<br>ポイント</h3><p>翌月なかばに<br>期間限定で入る</p></div><div class="arrow">→</div><div class="step"><div class="n">出口①</div><h3>食費に流す</h3><p>楽天ペイで<br>いつものお店</p></div><div class="arrow">→</div><div class="step"><div class="n">結果</div><h3>現金が浮く</h3><p>財布から<br>出なかった分</p></div><div class="arrow">→</div><div class="step" style="border-color:#E8735A"><div class="n">出口②</div><h3>残す口座へ</h3><p>給料日の翌日に<br>先に移す</p></div></div><div class="row mt"><div class="card bgs center"><p>毎月25日</p><h2 style="margin:0">ポイント確認 3分</h2></div><div class="card bgs center"><p>給料日の翌日</p><h2 style="margin:0">移す＋月じまい 15分</h2></div></div>`),
  p7_breakdown: breakdown,
};
(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  for (const [k, html] of Object.entries(figs)) {
    await pg.setContent(`<html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
    await pg.evaluate(() => document.fonts.ready);
    await (await pg.$('.fig')).screenshot({ path: path.join(OUT, k + '.png') });
  }
  await br.close();
  console.log(Object.keys(figs).length);
})();
