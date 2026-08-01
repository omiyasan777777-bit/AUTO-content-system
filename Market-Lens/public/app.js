const hoursAgo = (hours) => new Date(Date.now() - hours * 3600_000).toISOString();
const demoArticles = [
  {id:"d1",title:"会社員のまま、小さく始めるAI副業の設計図",author:"佐伯｜ひとり事業",category:"副業",price:1980,likes:428,publishedAt:hoursAgo(4),tags:["AI","副業","仕組み化"],image:"https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",description:"時間を切り売りせず、会社員のまま検証できる小さな事業の作り方。テーマ選定から販売導線までをまとめた実践ガイド。",source:"demo"},
  {id:"d2",title:"読まれる文章は、最初の3行でほぼ決まる",author:"ミナミ｜編集者",category:"ライティング",price:980,likes:812,publishedAt:hoursAgo(13),tags:["文章術","note","タイトル"],image:"https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",description:"編集の現場で使っている、読者を迷わせない文章設計。タイトル、書き出し、見出しの改善例を中心に解説します。",source:"demo"},
  {id:"d3",title:"SNSに疲れず、毎月売れるコンテンツ導線",author:"haru / creator",category:"マーケティング",price:2980,likes:339,publishedAt:hoursAgo(21),tags:["SNS","コンテンツ販売","導線設計"],image:"https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",description:"毎日投稿に依存しないコンテンツ販売の導線を、認知・信頼・販売の3段階に分けて設計します。",source:"demo"},
  {id:"d4",title:"恋愛で追われる人が、無意識にやめていること",author:"凪｜関係心理",category:"恋愛",price:1480,likes:1065,publishedAt:hoursAgo(30),tags:["恋愛","心理","コミュニケーション"],image:"https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80",description:"テクニックではなく関係性の作り方から考える恋愛心理。具体的な会話例と距離感の整え方を紹介します。",source:"demo"},
  {id:"d5",title:"Notionでつくる、ひとり会社の管理システム",author:"森田 / Ops Designer",category:"仕事術",price:2480,likes:576,publishedAt:hoursAgo(55),tags:["Notion","仕事術","テンプレート"],image:"https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=80",description:"案件、売上、タスク、発信をひとつにつなぐデータベース設計。迷子にならない運用ルールも収録。",source:"demo"},
  {id:"d6",title:"30日で整える、朝の習慣とセルフケア",author:"mugi｜暮らしの記録",category:"ライフスタイル",price:500,likes:923,publishedAt:hoursAgo(92),tags:["習慣","セルフケア","朝活"],image:"https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=900&q=80",description:"頑張りすぎない朝時間の作り方。30日分の小さな問いと、生活を立て直すためのチェックリスト。",source:"demo"},
  {id:"d7",title:"知識ゼロから始める、長期投資の判断軸",author:"小川｜生活とお金",category:"投資",price:3980,likes:267,publishedAt:hoursAgo(160),tags:["投資","資産形成","初心者"],image:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80",description:"銘柄の推奨ではなく、自分で判断するための考え方に特化した入門書。リスクと時間軸を整理します。",source:"demo"},
  {id:"d8",title:"子どもの『やりたい』を守る声かけノート",author:"ことり｜親子の対話",category:"子育て",price:780,likes:654,publishedAt:hoursAgo(300),tags:["子育て","教育","声かけ"],image:"https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80",description:"親子の衝突を減らし、子どもの意思を尊重する声かけを場面別にまとめました。",source:"demo"},
];

const storedSearchResults = read("marketlens.searchResults", []);
const state = {
  imported: read("marketlens.imported", []),
  articles: storedSearchResults,
  saved: new Set(read("marketlens.saved", [])),
  query:storedSearchResults.length ? read("marketlens.lastQuery", "") : "", category:"すべて", period:"all", sort:"popular", soldOnly:false, minPrice:0, maxPrice:1000000, layout:"grid", view:"research",
  limit: Number(read("marketlens.limit", 30)) || 30, hasMore:false, lastMeta:null,
};

const $ = (selector) => document.querySelector(selector);
const yen = (value) => value ? `¥${Number(value).toLocaleString("ja-JP")}` : "無料 / 未取得";
const escapeHtml = (text="") => String(text).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const ageHours = (date) => Math.max(0, (Date.now() - new Date(date).getTime()) / 3600_000);
const formatDate = (date) => new Intl.DateTimeFormat("ja-JP",{month:"short",day:"numeric"}).format(new Date(date));

function score(article) {
  const recency = Math.max(0, 35 - Math.log2(ageHours(article.publishedAt) + 1) * 6);
  const affinity = Math.min(50, Math.log10((article.likes || 0) + 1) * 17);
  const completeness = (article.price > 0 ? 8 : 2) + Math.min(7, (article.tags?.length || 0) * 2);
  return Math.max(1, Math.min(99, Math.round(recency + affinity + completeness)));
}

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist() {
  localStorage.setItem("marketlens.saved", JSON.stringify([...state.saved]));
  localStorage.setItem("marketlens.imported", JSON.stringify(state.imported));
  localStorage.setItem("marketlens.searchResults", JSON.stringify(state.articles.filter((x) => x.source === "note-search")));
  localStorage.setItem("marketlens.lastQuery", JSON.stringify(state.query));
  localStorage.setItem("marketlens.limit", JSON.stringify(state.limit));
}

function filtered() {
  let result = state.articles.filter((a) => {
    const withinPeriod = state.period === "all" || ageHours(a.publishedAt) <= Number(state.period);
    return (!state.soldOnly || a.bought24h === true) && (state.category === "すべて" || a.category === state.category)
      && withinPeriod && (a.price || 0) >= state.minPrice && (a.price || 0) <= state.maxPrice;
  });
  result.sort((a,b) => {
    if (state.sort === "new") return new Date(b.publishedAt)-new Date(a.publishedAt);
    return (a.rank || 999) - (b.rank || 999);
  });
  return result;
}

function placeholder(article) {
  const palette = ["#dfe8ce","#f4d8ca","#caddea","#e8dfc6"];
  const color = palette[Math.abs([...article.title].reduce((n,c)=>n+c.charCodeAt(0),0))%palette.length];
  const text = escapeHtml(article.category || "note");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 480"><rect width="900" height="480" fill="${color}"/><path d="M-20 420L250 110l150 170L560 70l370 410H-20z" fill="#fff" opacity=".35"/><text x="55" y="90" font-family="sans-serif" font-size="32" font-weight="700" fill="#262b23">${text}</text></svg>`)}`;
}

function card(a) {
  const saved = state.saved.has(a.id);
  return `<article class="article-card" data-id="${escapeHtml(a.id)}" tabindex="0">
    <div class="thumb"><img src="${escapeHtml(a.image || placeholder(a))}" alt="" loading="lazy" onerror="this.src='${placeholder(a)}'">
      <span class="category-badge">${escapeHtml(a.category)}</span>${a.bought24h?'<span class="sold-badge">購入あり · 24h以内</span>':`<span class="score-pill">注目度 ${score(a)}</span>`}
      <button class="save-button ${saved?"saved":""}" data-save="${escapeHtml(a.id)}" aria-label="${saved?"保存を解除":"保存"}">${saved?"◆":"◇"}</button>
    </div><div class="card-body"><h3>${escapeHtml(a.title)}</h3><div class="author-row"><span>${escapeHtml(a.author)}</span><span>${formatDate(a.publishedAt)}</span></div>
    <div class="card-stats"><div class="stat"><span>価格</span><strong>${yen(a.price)}</strong></div><div class="stat"><span>スキ</span><strong>${Number(a.likes||0).toLocaleString()}</strong></div><div class="stat"><span>公開から</span><strong>${ageLabel(a.publishedAt)}</strong></div></div></div></article>`;
}

function ageLabel(date) { const h=ageHours(date); return h<24?`${Math.max(1,Math.round(h))}時間`:`${Math.round(h/24)}日`; }

function updateLoadMore() {
  const row = $("#loadMoreRow");
  if (!row) return;
  const visible = Boolean(state.query) && state.hasMore && !state.soldOnly && state.limit < 200;
  row.hidden = !visible;
  if (visible) $("#loadMore").textContent = `さらに読み込む（現在${state.articles.length}件 → +30件）`;
}

function renderSearchMeta(items) {
  const meta = state.lastMeta;
  if (!meta) return;
  if (meta.soldOnly) {
    $("#searchMeta").innerHTML = `<span class="live-dot"></span> 有料候補${meta.candidatesFound}件中${meta.candidatesChecked}件を確認 · 「買われています｜過去24時間以内」${meta.matchedCount}件中、条件に合う${items.length}件を表示${meta.checkFailures?` · 確認失敗${meta.checkFailures}件`:""} · <a href="${escapeHtml(meta.sourceUrl)}" target="_blank" rel="noopener">検索元を開く ↗</a>`;
  } else {
    const sortName = {popular:"人気",hot:"急上昇",new:"新着"}[meta.sort];
    const scope = meta.expanded ? `関連タグ（${meta.searched.map(escapeHtml).join("・")}）` : `#${escapeHtml(state.query)}`;
    const freshness = meta.cached ? "（5分キャッシュ）" : meta.refreshed ? "（最新に更新済み）" : "";
    $("#searchMeta").innerHTML = `<span class="live-dot"></span> note ${scope} の${sortName}から${meta.matchedCount}件取得${freshness} · 条件に合う${items.length}件を表示 · 全${escapeHtml(meta.total || "件数不明")} · <a href="${escapeHtml(meta.sourceUrl)}" target="_blank" rel="noopener">検索元を開く ↗</a>`;
  }
}

function render() {
  const items = filtered();
  $("#articleGrid").innerHTML = items.map(card).join("");
  $("#articleTable").innerHTML = items.map((a) => `<tr><td><div class="table-title"><img src="${escapeHtml(a.image||placeholder(a))}" alt=""><div><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.author)}</small></div></div></td><td>${escapeHtml(a.category)}</td><td>${yen(a.price)}</td><td>${Number(a.likes||0).toLocaleString()}</td><td><b>${score(a)}</b> / 99</td><td><button class="table-save" data-save="${escapeHtml(a.id)}">${state.saved.has(a.id)?"◆":"◇"}</button></td></tr>`).join("");
  $("#resultSummary").textContent = state.query ? (state.soldOnly ? `「${state.query}」で24時間以内の購入表示を確認できた${items.length}件` : `「#${state.query}」から${items.length}件を表示 · noteの公開検索結果です`) : "キーワードからnoteの実記事を検索できます";
  const filtersNarrowedToZero = state.query && !state.soldOnly && state.articles.length > 0 && items.length === 0
    && (state.minPrice > 0 || state.maxPrice < 1000000 || state.category !== "すべて" || state.period !== "all");
  $("#emptyState h3").textContent = state.query ? (state.soldOnly ? "24時間以内の購入表示がある記事は見つかりませんでした" : "条件に合う記事がありません") : "noteを検索してみましょう";
  $("#emptyState p").textContent = state.query
    ? (state.soldOnly
        ? "別のジャンルを試すか、並び順を変更して再検索してください。"
        : (filtersNarrowedToZero
            ? "取得済みの記事の中にこの条件に合うものがありませんでした。取得件数を増やすか「さらに読み込む」で対象を広げると見つかる場合があります。"
            : "期間や価格フィルターを変えてみてください。"))
    : "上の検索欄にジャンルやキーワードを入力してください。";
  $("#emptyState").hidden = items.length !== 0;
  $("#articleGrid").hidden = state.layout !== "grid" || !items.length;
  $("#tableWrap").hidden = state.layout !== "table" || !items.length;
  updateLoadMore();
  renderSearchMeta(items);
  const savedItems = [...new Map([...state.articles,...state.imported].map((a)=>[a.id,a])).values()].filter((a)=>state.saved.has(a.id));
  $("#savedGrid").innerHTML = savedItems.map(card).join("");
  $("#savedEmpty").hidden = savedItems.length > 0;
  $("#savedCount").textContent = state.saved.size;
  renderAnalysis(items);
}

function renderCategories() {
  const cats = ["すべて",...new Set(state.articles.map((a)=>a.category).filter(Boolean))];
  $("#categories").innerHTML = cats.map((c)=>`<button class="chip ${c===state.category?"active":""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
}

function renderAnalysis(items) {
  const prices = items.filter((a)=>a.price>0).map((a)=>a.price);
  const avgPrice = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : 0;
  const avgLikes = items.length ? Math.round(items.reduce((n,a)=>n+(a.likes||0),0)/items.length) : 0;
  const avgScore = items.length ? Math.round(items.reduce((n,a)=>n+score(a),0)/items.length) : 0;
  $("#metrics").innerHTML = [
    ["分析対象",items.length,"件"],["平均価格",`¥${avgPrice.toLocaleString()}`,""],["平均スキ",avgLikes.toLocaleString(),""],["平均注目度",avgScore,"/ 99"]
  ].map(([label,value,unit])=>`<div class="metric"><span>${label}</span><strong>${value}</strong><small>${unit}</small></div>`).join("");
  const byCat = Object.entries(items.reduce((m,a)=>{(m[a.category]??=[]).push(score(a));return m},{})).map(([name,values])=>({name,value:Math.round(values.reduce((a,b)=>a+b,0)/values.length)})).sort((a,b)=>b.value-a.value).slice(0,7);
  const maxCat = Math.max(1,...byCat.map((x)=>x.value));
  $("#categoryChart").innerHTML = byCat.map((x)=>`<div class="bar-row"><span>${escapeHtml(x.name)}</span><div class="bar-track"><i style="width:${x.value/maxCat*100}%"></i></div><b>${x.value}</b></div>`).join("") || "<p class='empty'>データがありません</p>";
  const buckets = [{label:"〜¥999",min:0,max:999},{label:"¥1,000台",min:1000,max:1999},{label:"¥2,000台",min:2000,max:2999},{label:"¥3,000〜",min:3000,max:Infinity}];
  const counts = buckets.map((b)=>({...b,count:items.filter((a)=>a.price>=b.min&&a.price<=b.max).length})); const maxCount=Math.max(1,...counts.map((x)=>x.count));
  $("#priceChart").innerHTML = counts.map((x)=>`<div class="price-column"><b>${x.count}</b><i style="height:${Math.max(3,x.count/maxCount*125)}px"></i><span>${x.label}</span></div>`).join("");
  const stop = new Set(["note","する","から","まで","その","これ","ため"]); const words={};
  items.forEach((a)=>{const candidates=[...(a.tags||[]),...a.title.split(/[\s、。・「」『』！？!?／\-]+/)];candidates.forEach((w)=>{w=w.trim();if(w.length>1&&!stop.has(w.toLowerCase()))words[w]=(words[w]||0)+score(a)})});
  $("#keywordCloud").innerHTML = Object.entries(words).sort((a,b)=>b[1]-a[1]).slice(0,18).map(([w,n],i)=>`<span style="font-size:${Math.max(10,16-i*.3)}px">${escapeHtml(w)} <small>${Math.round(n/Math.max(1,avgScore))}</small></span>`).join("");
}

function openArticle(id) {
  const a = [...state.articles,...state.imported].find((x)=>x.id===id); if(!a)return;
  $("#drawerContent").innerHTML = `<img class="drawer-hero" src="${escapeHtml(a.image||placeholder(a))}" alt=""><div class="drawer-inner"><p class="eyebrow">${escapeHtml(a.category)} · SCORE ${score(a)}</p><h2>${escapeHtml(a.title)}</h2><p class="author">${escapeHtml(a.author)} · ${formatDate(a.publishedAt)}公開</p><div class="drawer-stats"><div class="drawer-stat"><span>価格</span><strong>${yen(a.price)}</strong></div><div class="drawer-stat"><span>スキ</span><strong>${Number(a.likes||0).toLocaleString()}</strong></div><div class="drawer-stat"><span>注目度</span><strong>${score(a)} / 99</strong></div></div>${a.bought24h?'<div class="confidence"><b>✓ 買われています｜過去24時間以内</b><br>noteの記事ページに表示された公開文言を確認済みです。販売数そのものは公開されていません。</div>':'<div class="confidence"><b>この数値について</b><br>公開からの時間、スキ数、価格・タグの充実度を合成した相対スコアです。販売数や売上を示すものではありません。</div>'}<p class="drawer-description">${escapeHtml(a.description||"説明文は取得できませんでした。元記事で内容をご確認ください。")}</p><div class="tag-list">${(a.tags||[]).map((t)=>`<span>#${escapeHtml(t)}</span>`).join("")}</div><div class="drawer-actions"><button class="button ghost" data-save="${escapeHtml(a.id)}">${state.saved.has(a.id)?"保存を解除":"◇ 保存する"}</button>${a.url?`<a class="button dark" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">元記事を開く ↗</a>`:""}</div></div>`;
  $("#drawerBackdrop").hidden=false; $("#detailDrawer").classList.add("open"); $("#detailDrawer").setAttribute("aria-hidden","false");
}

function closeDrawer(){ $("#detailDrawer").classList.remove("open"); $("#detailDrawer").setAttribute("aria-hidden","true"); setTimeout(()=>$("#drawerBackdrop").hidden=true,280); }
function toggleSave(id){ state.saved.has(id)?state.saved.delete(id):state.saved.add(id); persist(); render(); if($("#detailDrawer").classList.contains("open"))openArticle(id); toast(state.saved.has(id)?"保存しました":"保存を解除しました"); }
function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2200)}

function switchView(name){
  state.view = name;
  document.querySelectorAll("[data-view]").forEach((b)=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach((v)=>v.classList.remove("active"));
  $(`#${name}View`).classList.add("active");
}

function syncLimitSelect(){
  const select = $("#limitFilter");
  if (![...select.options].some((option)=>option.value===String(state.limit))) {
    const option = document.createElement("option");
    option.value = String(state.limit);
    option.textContent = `${state.limit}件`;
    select.appendChild(option);
  }
  select.value = String(state.limit);
}

async function runSearch(options = {}) {
  const raw = $("#searchInput").value.trim();
  if (!raw) { $("#searchInput").focus(); return; }
  const isUrl = /^https?:\/\//i.test(raw) || /^([a-z0-9-]+\.)?note\.com\//i.test(raw);
  localStorage.setItem("marketlens.lastAttempt", JSON.stringify(raw));
  const button = $("#searchSubmit");
  button.disabled = true; button.textContent = "検索中…";
  $("#searchMeta").innerHTML = `<span class="live-dot"></span> ${isUrl ? "URLを確認しています…" : `noteで「#${escapeHtml(raw.replace(/^[#＃]/,""))}」を探しています…`}${options.refresh?"（キャッシュを使わず更新中）":""}`;
  try {
    const response = await fetch("/api/search", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({keyword:raw, sort:state.sort, soldOnly:state.soldOnly, limit:state.limit, refresh:options.refresh===true}) });
    const data = await response.json();
    if (!response.ok) { const failure = new Error(data.error || "検索できませんでした。"); failure.noteSearchUrl = data.noteSearchUrl; throw failure; }
    state.query = data.keyword; state.articles = data.articles; state.category = "すべて";
    state.hasMore = !data.soldOnly && Boolean(data.hasMore);
    if (data.singleArticle) {
      const article = data.articles[0];
      state.imported = state.imported.filter((a) => a.url !== article.url);
      state.imported.unshift(article);
      state.lastMeta = null;
    } else {
      state.lastMeta = {
        soldOnly: data.soldOnly, candidatesFound: data.candidatesFound, candidatesChecked: data.candidatesChecked,
        checkFailures: data.checkFailures, sourceUrl: data.sourceUrl, sort: data.sort, expanded: data.expanded,
        searched: data.searched, total: data.total, cached: data.cached, refreshed: options.refresh === true,
        matchedCount: data.articles.length,
      };
    }
    persist(); renderCategories(); render();
    if (data.singleArticle) {
      $("#searchMeta").innerHTML = `<span class="live-dot"></span> URLから記事を1件取得しました · <a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noopener">元記事を開く ↗</a>`;
      toast("記事を取得しました");
    } else {
      toast(`${data.articles.length}件見つかりました`);
    }
  } catch (error) {
    const fallback = error.noteSearchUrl ? ` <a href="${escapeHtml(error.noteSearchUrl)}" target="_blank" rel="noopener">note全文検索で探す ↗</a>` : "";
    $("#searchMeta").innerHTML = `<span class="live-dot" style="background:#d75f45"></span> ${escapeHtml(error.message)}${fallback}`;
    toast(error.message);
  } finally { button.disabled = false; button.textContent = "noteを検索"; }
}

// ---- 穴場ジャンル ----

function parseGenreInput(value) {
  return String(value || "").split(/[、,\/／\s]+/).map((g)=>g.replace(/^[#＃]/,"").trim()).filter(Boolean).slice(0,14);
}

function renderGap(data) {
  $("#gapResults").innerHTML = data.results.map((r, index) => `<div class="gap-item">
    <div class="gap-head"><span class="gap-rank">${index+1}</span><div><h4>#${escapeHtml(r.genre)}</h4><span class="gap-label ${r.score>=65?"hot":r.score>=50?"warm":"cool"}">${escapeHtml(r.label)}</span></div></div>
    <div class="gap-main">
      <div class="bar-track"><i style="width:${r.score}%"></i></div>
      <div class="gap-metrics"><span>穴場度 <b>${r.score}</b>/100</span><span>平均スキ <b>${Number(r.avgLikes||0).toLocaleString()}</b></span><span>有料率 <b>${Math.round((r.paidRatio||0)*100)}%</b></span><span>平均価格 <b>${r.avgPrice?`¥${Number(r.avgPrice).toLocaleString()}`:"—"}</b></span><span>記事数 <b>${r.totalCount?Number(r.totalCount).toLocaleString():"不明"}</b></span><span>新着 <b>${r.postsPerDay}</b>/日</span></div>
      <p class="gap-comment">${escapeHtml(r.comment)}</p>
    </div>
    <div class="gap-actions"><button class="button ghost small" data-genre="${escapeHtml(r.genre)}">検索する</button><a class="button ghost small" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">note ↗</a></div>
  </div>`).join("");
}

async function runGapScan() {
  const button = $("#gapRun");
  button.disabled = true; button.textContent = "調査中…";
  $("#gapStatus").innerHTML = `<span class="live-dot"></span> 各ジャンルの人気記事・新着投稿を取得しています…（30〜60秒ほどお待ちください）`;
  try {
    const genres = parseGenreInput($("#gapGenres").value);
    const response = await fetch("/api/gap", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({genres}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "分析できませんでした。");
    renderGap(data);
    $("#gapStatus").innerHTML = `<span class="live-dot"></span> ${data.results.length}ジャンルを分析しました${data.cached?"（30分キャッシュ）":""} · 穴場度 = 需要（スキ・有料率）×供給の少なさ（記事数・投稿量）。取得: ${new Date(data.fetchedAt).toLocaleString("ja-JP")}`;
    toast("穴場ジャンル分析が完了しました");
  } catch (error) {
    $("#gapStatus").innerHTML = `<span class="live-dot" style="background:#d75f45"></span> ${escapeHtml(error.message)}`;
    toast(error.message);
  } finally { button.disabled = false; button.textContent = "穴場を調査する"; }
}

// ---- 人気ワード ----

function renderTrends(data) {
  const cloud = data.words.slice(0, 30).map((w, index) => `<button class="trend-chip" data-genre="${escapeHtml(w.word)}" style="font-size:${Math.max(11, 17 - index * 0.35)}px" title="出現${w.count}回 · 平均スキ${w.avgLikes}">${escapeHtml(w.word)}<small>${w.count}</small></button>`).join("");
  const rows = data.words.slice(0, 20).map((w, index) => `<tr><td>${index+1}</td><td><b>${escapeHtml(w.word)}</b></td><td>${w.score}</td><td>${w.count}</td><td>${Number(w.avgLikes||0).toLocaleString()}</td><td>${w.genres.map(escapeHtml).join("・")}</td></tr>`).join("");
  $("#trendsResults").innerHTML = `<div class="keyword-cloud trend-cloud">${cloud}</div>
    <div class="table-wrap trend-table"><table><thead><tr><th>#</th><th>ワード</th><th>スコア</th><th>出現数</th><th>平均スキ</th><th>出現ジャンル</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function runTrends() {
  const button = $("#trendsRun");
  button.disabled = true; button.textContent = "集計中…";
  $("#trendsStatus").innerHTML = `<span class="live-dot"></span> 各ジャンルの人気・新着記事からワードを集計しています…`;
  try {
    const genres = parseGenreInput($("#trendsGenres").value);
    const response = await fetch("/api/trends", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({genres}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "集計できませんでした。");
    renderTrends(data);
    $("#trendsStatus").innerHTML = `<span class="live-dot"></span> ${data.genres.map(escapeHtml).join("・")} の${data.articleCount}記事からワードを集計${data.cached?"（30分キャッシュ）":""} · スコア = 出現数 × スキ数 × 新しさの重み。ワードをクリックで検索できます。`;
    toast("人気ワードの集計が完了しました");
  } catch (error) {
    $("#trendsStatus").innerHTML = `<span class="live-dot" style="background:#d75f45"></span> ${escapeHtml(error.message)}`;
    toast(error.message);
  } finally { button.disabled = false; button.textContent = "人気ワードを集計する"; }
}

document.addEventListener("click",(event)=>{
  const genre=event.target.closest("[data-genre]"); if(genre){switchView("research");$("#searchInput").value=genre.dataset.genre;runSearch();return}
  const save=event.target.closest("[data-save]"); if(save){event.stopPropagation();toggleSave(save.dataset.save);return}
  const article=event.target.closest(".article-card"); if(article){openArticle(article.dataset.id);return}
  const category=event.target.closest("[data-category]"); if(category){state.category=category.dataset.category;renderCategories();render();return}
  const layout=event.target.closest("[data-layout]"); if(layout){state.layout=layout.dataset.layout;document.querySelectorAll("[data-layout]").forEach((b)=>b.classList.toggle("active",b===layout));render();return}
  const nav=event.target.closest("[data-view]"); if(nav){switchView(nav.dataset.view);return}
  const guideClose=event.target.closest("[data-close='guide']");if(guideClose)$("#guideDialog").close();
});

$("#searchForm").addEventListener("submit",(event)=>{event.preventDefault();runSearch()});
$("#periodFilter").addEventListener("change",(e)=>{state.period=e.target.value;render()});
$("#sortFilter").addEventListener("change",(e)=>{state.sort=e.target.value;if(state.query)runSearch();else render()});
$("#limitFilter").addEventListener("change",(e)=>{state.limit=Number(e.target.value)||30;persist();if(state.query)runSearch();});
$("#refreshButton").addEventListener("click",()=>{if(state.query||$("#searchInput").value.trim())runSearch({refresh:true});else toast("先にキーワードを検索してください")});
$("#loadMore").addEventListener("click",()=>{state.limit=Math.min(200,state.limit+30);syncLimitSelect();persist();runSearch()});
$("#soldOnly").addEventListener("change",(e)=>{state.soldOnly=e.target.checked;if(state.query)runSearch();else render()});
$("#gapRun").addEventListener("click",runGapScan);
$("#trendsRun").addEventListener("click",runTrends);
$("#priceButton").addEventListener("click",()=>$("#pricePopover").hidden=!$("#pricePopover").hidden);
$("#applyPrice").addEventListener("click",()=>{state.minPrice=Number($("#minPrice").value||0);state.maxPrice=Number($("#maxPrice").value||Infinity);$("#priceLabel").textContent=state.minPrice===0&&state.maxPrice===1000000?"すべて":`${yen(state.minPrice)}–${yen(state.maxPrice)}`;$("#pricePopover").hidden=true;render()});
$("#drawerClose").addEventListener("click",closeDrawer);$("#drawerBackdrop").addEventListener("click",closeDrawer);
$("#openGuide").addEventListener("click",()=>$("#guideDialog").showModal());
$("#importButton").addEventListener("click",()=>{$("#importError").textContent="";$("#importDialog").showModal()});

$("#importForm").addEventListener("submit",async(event)=>{
  event.preventDefault(); const button=$("#importSubmit"), url=$("#urlInput").value.trim();
  button.disabled=true;button.textContent="取得しています…";$("#importError").textContent="";
  try{const response=await fetch("/api/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});const data=await response.json();if(!response.ok)throw new Error(data.error);state.imported=state.imported.filter((a)=>a.url!==data.article.url);state.imported.unshift(data.article);state.articles=state.articles.filter((a)=>a.url!==data.article.url);state.articles.unshift(data.article);persist();renderCategories();render();$("#importDialog").close();$("#urlInput").value="";toast("記事を追加しました");}
  catch(error){$("#importError").textContent=error.message||"取得できませんでした。"}finally{button.disabled=false;button.textContent="公開情報を取得"}
});

$("#exportButton").addEventListener("click",()=>{
  const rows=[["タイトル","著者","ジャンル","価格","スキ数","注目度","公開日時","タグ","URL"],...filtered().map((a)=>[a.title,a.author,a.category,a.price,a.likes,score(a),a.publishedAt,(a.tags||[]).join(" / "),a.url||""])];
  const csv="\ufeff"+rows.map((row)=>row.map((v)=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`market-lens-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);toast(`${rows.length-1}件を書き出しました`);
});

document.addEventListener("keydown",(event)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#searchInput").focus()}if(event.key==="Escape"&&$("#detailDrawer").classList.contains("open"))closeDrawer()});

$("#searchInput").value = state.query;
if (state.query && state.articles.length) $("#searchMeta").innerHTML = `<span class="live-dot"></span> 前回の「#${escapeHtml(state.query)}」検索結果を表示しています。検索ボタンまたは「🔄 最新に更新」で再取得できます。`;
syncLimitSelect(); renderCategories(); render();
