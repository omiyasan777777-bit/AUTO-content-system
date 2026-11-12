const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2];
const F = path.join(__dirname, 'node_modules/@fontsource/noto-sans-jp/files');
const b64 = w => fs.readFileSync(path.join(F, `noto-sans-jp-japanese-${w}-normal.woff2`)).toString('base64');
const css = `${[400,700,900].map(w=>`@font-face{font-family:NS;font-weight:${w};src:url(data:font/woff2;base64,${b64(w)}) format('woff2');}`).join('')}
@page{size:A4;margin:14mm 14mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:NS,sans-serif;color:#2F2A26;font-size:11pt;line-height:1.6}
.k{color:#E8735A;font-weight:700;font-size:10pt;letter-spacing:.08em}
h1{font-size:22pt;font-weight:900;line-height:1.3;margin:2mm 0 2mm}
.sub{color:#6E645C;font-size:10pt;margin-bottom:5mm}
h2{font-size:13pt;font-weight:900;background:#2F6B5A;color:#fff;padding:1.5mm 4mm;border-radius:2mm;margin:5mm 0 2mm}
h2.c{background:#E8735A}
.it{display:flex;align-items:flex-start;gap:3mm;padding:1.6mm 1mm;border-bottom:.3mm dashed #D9CBB8;break-inside:avoid}
.bx{flex:0 0 5mm;height:5mm;border:.5mm solid #2F2A26;border-radius:1mm;margin-top:.8mm}
.d{flex:0 0 26mm;font-weight:700}
.t{flex:1}.m{flex:0 0 22mm;text-align:right;color:#6E645C;font-size:9.5pt}
.wk{break-inside:avoid}
.box{border:.6mm solid #E8735A;border-radius:3mm;padding:4mm 6mm;margin:4mm 0;break-inside:avoid}
.box.g{border-color:#2F6B5A}
.q{font-size:14.5pt;font-weight:900;line-height:1.45;margin:1.5mm 0}
.big{font-size:13pt;font-weight:700}
ol{padding-left:7mm} ol li{font-size:11.5pt;font-weight:700;padding:.9mm 0}
ol li span{display:block;font-size:10pt;font-weight:400;color:#6E645C}
.line{border-bottom:.3mm solid #2F2A26;height:7mm}
.foot{color:#8A7F76;font-size:8.5pt;margin-top:5mm}
.pb{break-before:page}`;
const it = (d,t,m)=>`<div class="it"><div class="bx"></div><div class="d">${d}</div><div class="t">${t}</div><div class="m">${m||''}</div></div>`;
const sched = `<div class="k">楽天・持ち場家計の設計図　特典5</div><h1>30日実行スケジュール</h1><div class="sub">1日に使う時間は、長くても30分。できなかった日は、次の日に回して大丈夫です。</div>
<div class="wk"><h2>1週目　見える化する</h2>${it('1日目','洗面所の在庫写真を1枚撮る','1分')}${it('2日目','持ち場の線を引く（見る範囲を決める）','10分')}${it('3日目','家じゅうの在庫さんぽ（洗面所→トイレ→台所→押し入れ）','15分')}${it('4日目','カード明細を3か月分ひらく','10分')}${it('5日目','3つの箱に分けて、月額と回数を出す → 月じまいシートに記入','20分')}${it('6〜7日目','おやすみ','')}</div>
<div class="wk"><h2>2週目　買う物を固定する</h2>${it('8日目','定番を10品書く','15分')}${it('9日目','お店で定番の値札を撮ってくる','ついでに')}${it('10日目','楽天で定番を探し、お気に入りに入れる','30分')}${it('11日目','買わない物リストを作り、目に入る場所に置く','15分')}${it('12日目','楽天・お店の箱に振り分ける','15分')}${it('13〜14日目','おやすみ','')}</div>
<div class="wk pb"><h2>3週目　買う日を固定する</h2>${it('15日目','次の買い回りの日程を確認し、買う日を決める','5分')}${it('16日目','楽天カード・楽天市場アプリの準備（未設定の方のみ）','')}${it('17日目','年間カレンダーに大きな買い物を3つ置く','10分')}${it('買う日の前日','準備：カートを完成させる（判断はここで全部すませる）','15分')}${it('買う日','エントリー → クーポン → 購入 → メモ（夜10時以降は買わない）','75分')}${it('残りの日','おやすみ','')}</div>
<div class="wk"><h2>4週目　出口を固定して、回す</h2>${it('22日目','楽天ペイを入れ、ポイント払いをオンにする','10分')}${it('23日目','ポイントで払うお店を1つ決める','5分')}${it('24日目','「残す口座」を決め、移す日をカレンダーに入れる','10分')}${it('25日目','ポイント残高を確認する（今月末で切れる分があるか）','3分')}${it('給料日の翌日','最初の月じまい＋最初の振り込み（3,000円でもOK）','15分')}${it('30日目','夫に、ひと言だけ報告する','1分')}</div>
<div class="box g"><div class="big">30日目のわたしへ</div><div class="sub" style="margin:1mm 0 0">最初に残す口座へ移せた金額：　　　　　　　円　／　いちばん楽になったこと：</div><div class="line"></div></div>
<div class="foot">※ポイントの倍率・上限・キャンペーンの内容は変わることがあります。買う前に公式ページで確認してください。</div>`;
const one = `<div class="k">楽天・持ち場家計の設計図　特典6</div><h1>買う前に、この1枚</h1><div class="sub">冷蔵庫に貼るか、写真に撮ってスマホの待ち受けに。</div>
<div class="box"><div class="k">定番以外の物が欲しくなったら</div><div class="q">問い1：これは、来月買う予定だった物？</div><div class="q">問い2：いま買って、置く場所はある？</div><div class="big" style="margin-top:3mm">両方「はい」→ 買ってOK　／　どちらかが「いいえ」→ お気に入りに入れて、今回は見送り</div></div>
<h2 class="c">わが家の買わない物リスト</h2><ol><li>店舗数を増やすためだけの1,000円商品<span>1店舗ふえても、増えるのは約300ポイント</span></li><li>使ったことのない物のまとめ買い</li><li>「いつか使う」収納グッズ・便利グッズ</li><li>子どもが欲しがっていないおもちゃ・教材</li><li>送料無料に届かせるための買い足し</li><li>（わが家の1つ）<div class="line"></div></li></ol>
<h2>買い回りの日の約束</h2><ol><li>買うのは月1回。前日15分＋当日75分</li><li>店舗数は埋めない。定番でうまる数が、わが家のちょうどいい数</li><li>夜10時以降は買わない</li><li>終わったらアプリを閉じて、お茶を飲む</li></ol>
<div class="box g" style="text-align:center"><div class="q" style="font-size:15pt">買う物・買う日・ポイントの出口。<br>3つを固定すれば、お金はちゃんと残る。</div></div>`;
(async()=>{const br=await chromium.launch();const pg=await br.newPage();
for(const [n,h] of [['05_30日実行スケジュール.pdf',sched],['06_貼っておく1枚_2問フィルターと買わない物.pdf',one]]){
await pg.setContent(`<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`);await pg.evaluate(()=>document.fonts.ready);
await pg.pdf({path:path.join(OUT,n),format:'A4',printBackground:true});}
await br.close();})();
