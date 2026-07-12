/* ============================================================
 * ショート動画メーカー
 * Canvas に毎フレーム描画し、プレビューと書き出しで
 * 同一の drawFrame(t) を使う（見たまま書き出せる）。
 * 書き出しは canvas.captureStream + MediaRecorder。
 * ============================================================ */

"use strict";

// ---------- 定数 ----------

const FPS = 30;
const BITRATE = 8_000_000;

const ASPECTS = {
  "9:16": { w: 720, h: 1280 },
  "1:1":  { w: 960, h: 960 },
  "16:9": { w: 1280, h: 720 },
};

const GRADIENTS = [
  { id: "midnight", name: "ミッドナイト", colors: ["#0f2027", "#2c5364"] },
  { id: "sunset",   name: "サンセット",   colors: ["#ff512f", "#dd2476"] },
  { id: "ocean",    name: "オーシャン",   colors: ["#2193b0", "#6dd5ed"] },
  { id: "sakura",   name: "サクラ",       colors: ["#f8a5c2", "#a6c1ee"] },
  { id: "gold",     name: "ゴールド",     colors: ["#141e30", "#b8860b"] },
  { id: "forest",   name: "フォレスト",   colors: ["#134e5e", "#71b280"] },
  { id: "neon",     name: "ネオン",       colors: ["#41295a", "#d4145a"] },
  { id: "mono",     name: "モノクロ",     colors: ["#232526", "#414345"] },
];

const FONTS = {
  gothic:  '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif',
  mincho:  '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
  rounded: '"Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif',
};

// ---------- 状態 ----------

const S = {
  aspect: "9:16",
  duration: 5,
  mainText: "",
  subText: "",
  badgeText: "",
  font: "gothic",
  fontSize: 64,
  textColor: "#ffffff",
  textAnim: "slideup",
  bgType: "gradient",
  gradient: GRADIENTS[0],
  solidColor: "#111827",
  bgImage: null,          // HTMLImageElement | null
  bgImageFile: null,      // File | null（AIモードの image-to-video 用）
  bgMotion: "zoom",
  scrim: 0.2,
  progressBar: true,
  fadeOut: true,
  prompt: "",
  fx: null, // parsePrompt() の結果（init で設定）
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// roundRect 未対応ブラウザ用フォールバック
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x + w, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

let playing = true;
let playT = 0;              // 現在の再生位置（秒）
let lastTick = null;        // 前フレームの timestamp
let exporting = false;

// ---------- ユーティリティ ----------

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
// 添字から決定論的な疑似乱数（毎フレーム同じ配置になる）
const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 改行を尊重しつつ、キャンバス幅に収まるよう1文字単位で折り返す
function wrapText(text, maxWidth) {
  const lines = [];
  for (const raw of text.split("\n")) {
    let line = "";
    for (const ch of raw) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

// ---------- プロンプト演出（日本語プロンプト → エフェクト設定） ----------

const FX_FILTERS = {
  warm:  "sepia(0.28) saturate(1.35) hue-rotate(-8deg) brightness(1.03)",
  cool:  "saturate(1.1) hue-rotate(15deg) brightness(1.02) contrast(1.02)",
  mono:  "grayscale(1) contrast(1.08)",
  sepia: "sepia(0.85) contrast(1.02)",
  vivid: "saturate(1.6) contrast(1.08)",
};

// ctx.filter 対応判定（Safari 旧版などは非対応 → フィルタのみスキップ）
const filterSupported = (() => {
  try {
    ctx.filter = "grayscale(1)";
    const ok = typeof ctx.filter === "string" && ctx.filter.includes("grayscale");
    ctx.filter = "none";
    return ok;
  } catch { return false; }
})();

// 順序が重要：具体的なキーワード（ズームアウト）を汎用（ズーム）より先に置く
const FX_KEYWORDS = [
  // カメラワーク（最初にマッチしたものを採用）
  { re: /ズームアウト|引いて|引きで|zoom\s*out/i,            cam: "zoomout",  chip: "📷 ズームアウト" },
  { re: /ズームイン|ズーム|寄って|寄せて|アップに|zoom/i,     cam: "zoomin",   chip: "📷 ズームイン" },
  { re: /ケンバーンズ|シネマ|映画風|映画っぽ/i,               cam: "kenburns", chip: "🎞️ ケンバーンズ" },
  { re: /左(へ|に)?(パン|スライド|流|移動)|パン.*左/i,        cam: "panleft",  chip: "📷 左へパン" },
  { re: /右(へ|に)?(パン|スライド|流|移動)|パン.*右/i,        cam: "panright", chip: "📷 右へパン" },
  { re: /上(へ|に)?(パン|スライド|流|移動)|パン.*上/i,        cam: "panup",    chip: "📷 上へパン" },
  { re: /下(へ|に)?(パン|スライド|流|移動)|パン.*下/i,        cam: "pandown",  chip: "📷 下へパン" },
  // モーション修飾
  { re: /揺れ|揺らし|シェイク|手ブレ|振動/i,  set: (f) => { f.shake = true; },  chip: "📳 揺れ" },
  { re: /鼓動|パルス|ドキドキ|脈打/i,         set: (f) => { f.pulse = true; },  chip: "💓 鼓動" },
  { re: /回転|回りながら|回して|rotate/i,     set: (f) => { f.rotate = true; }, chip: "🌀 回転" },
  // オーバーレイ
  { re: /光の粒|パーティクル|粒子/i,          ov: "particles", chip: "✨ 光の粒" },
  { re: /キラキラ|スパークル|星屑|きらめ/i,    ov: "sparkle",   chip: "🌟 キラキラ" },
  { re: /雪|スノー/i,                          ov: "snow",      chip: "❄️ 雪" },
  { re: /雨|レイン/i,                          ov: "rain",      chip: "🌧 雨" },
  { re: /桜|さくら|花びら/i,                   ov: "sakura",    chip: "🌸 桜吹雪" },
  { re: /光線|光が差|後光|木漏れ日|レイ(?!ン)/i, ov: "rays",     chip: "🔆 光線" },
  { re: /玉ボケ|ボケ感|ぼかし玉|ボケ/i,        ov: "bokeh",     chip: "🫧 玉ボケ" },
  // 開始演出
  { re: /フラッシュ|閃光|光って始/i,  set: (f) => { f.flash = true; }, chip: "⚡ フラッシュ開始" },
  // 色調（最初にマッチしたものを採用）
  { re: /セピア|レトロ|ノスタル|昔の写真/i,        flt: "sepia", chip: "🎨 セピア" },
  { re: /モノクロ|白黒|グレースケール/i,           flt: "mono",  chip: "🎨 モノクロ" },
  { re: /暖か|温か|夕焼け|オレンジっぽ|ぬくも/i,   flt: "warm",  chip: "🎨 暖色" },
  { re: /寒色|涼し|クール|青っぽ|冷た/i,           flt: "cool",  chip: "🎨 寒色" },
  { re: /鮮やか|ビビッド|カラフル|色鮮/i,          flt: "vivid", chip: "🎨 ビビッド" },
  // スピード
  { re: /ゆっくり|スロー|静かに|穏やか/i,      set: (f) => { f.speed = 0.6; }, chip: "🐢 ゆっくり" },
  { re: /速く|早く|激し|ダイナミック|勢いよく/i, set: (f) => { f.speed = 1.6; }, chip: "🐇 激しく" },
];

function parsePrompt(text) {
  const fx = {
    camera: null, shake: false, pulse: false, rotate: false,
    overlays: [], filter: null, flash: false, speed: 1,
    chips: [],
  };
  const src = (text || "").trim();
  if (!src) return fx;
  for (const rule of FX_KEYWORDS) {
    if (!rule.re.test(src)) continue;
    if (rule.cam) {
      if (fx.camera) continue; // カメラは最初の1つだけ
      fx.camera = rule.cam;
    } else if (rule.ov) {
      if (fx.overlays.includes(rule.ov)) continue;
      fx.overlays.push(rule.ov);
    } else if (rule.flt) {
      if (fx.filter) continue; // 色調も最初の1つだけ
      fx.filter = rule.flt;
    } else if (rule.set) {
      rule.set(fx);
    }
    fx.chips.push(rule.chip);
  }
  return fx;
}

function renderFxChips() {
  const wrap = $("fxChips");
  wrap.innerHTML = "";
  if (!S.prompt.trim()) return;
  if (S.fx.chips.length === 0) {
    const el = document.createElement("span");
    el.className = "chip none";
    el.textContent = "キーワードが見つかりません（下の例を参考にどうぞ）";
    wrap.appendChild(el);
    return;
  }
  for (const label of S.fx.chips) {
    const el = document.createElement("span");
    el.className = "chip";
    el.textContent = label;
    wrap.appendChild(el);
  }
}

// プロンプト由来のカメラワーク。指定が無ければ null（従来動作にフォールバック）
function promptCamera(t, W, H) {
  const f = S.fx;
  const hasMotion = f.camera || f.shake || f.pulse || f.rotate;
  if (!hasMotion) return null;

  const p = clamp(t / S.duration, 0, 1);
  const sp = f.speed;
  const panM = 0.045 * Math.min(sp, 1.3);
  let scale = 1, dx = 0, dy = 0, rot = 0;

  switch (f.camera) {
    case "zoomin":   scale = 1 + 0.10 * sp * p; break;
    case "zoomout":  scale = 1 + 0.10 * sp * (1 - p); break;
    case "kenburns": scale = 1.05 + 0.10 * p; dx = (p - 0.5) * -0.05 * W; dy = (p - 0.5) * -0.03 * H; break;
    case "panleft":  scale = 1.14; dx = (0.5 - p) * 2 * panM * W; break;
    case "panright": scale = 1.14; dx = (p - 0.5) * 2 * panM * W; break;
    case "panup":    scale = 1.14; dy = (0.5 - p) * 2 * panM * H; break;
    case "pandown":  scale = 1.14; dy = (p - 0.5) * 2 * panM * H; break;
  }
  if (f.rotate) { rot = (p - 0.5) * 0.10 * sp; scale *= 1.12; }
  if (f.pulse)  { scale *= 1 + 0.018 * sp * Math.sin(t * Math.PI * 2 * 1.4); }
  if (f.shake) {
    const a = 2.4 * sp * (W / 720);
    dx += (Math.sin(t * 23) + Math.sin(t * 41) * 0.5) * a;
    dy += (Math.cos(t * 29) + Math.sin(t * 37) * 0.5) * a;
    scale *= 1.02;
  }
  return { scale, dx, dy, rot };
}

// ---------- 背景描画 ----------

function drawGradient(t, W, H, colors) {
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  if (S.bgMotion === "pan") {
    // グラデーションの起点をゆっくり回すように動かす
    const a = (t / S.duration) * Math.PI * 0.5;
    x0 = W * 0.5 * (1 - Math.cos(a));
    y0 = H * 0.3 * Math.sin(a);
    x1 = W - x0;
    y1 = H - y0;
  }
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  // 回転・シェイク時に端が見えないよう少し広めに塗る
  ctx.fillRect(-W * 0.15, -H * 0.15, W * 1.3, H * 1.3);
}

function drawImageCover(img, W, H, scale) {
  const cr = W / H, ir = img.width / img.height;
  let dw, dh;
  if (ir > cr) { dh = H * scale; dw = dh * ir; }
  else         { dw = W * scale; dh = dw / ir; }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// 背景そのもの（画像 / 単色 / グラデ）をカメラ変形の内側で描く
function drawBase(t, W, H, extraScale) {
  if (S.bgType === "image" && S.bgImage) {
    drawImageCover(S.bgImage, W, H, extraScale);
  } else if (S.bgType === "solid") {
    ctx.fillStyle = S.solidColor;
    ctx.fillRect(-W * 0.15, -H * 0.15, W * 1.3, H * 1.3);
  } else {
    drawGradient(t, W, H, S.gradient.colors);
  }
}

function drawBackground(t, W, H) {
  const cam = promptCamera(t, W, H);

  ctx.save();
  if (filterSupported && S.fx.filter) ctx.filter = FX_FILTERS[S.fx.filter];

  if (cam) {
    // プロンプト指定のカメラワーク
    ctx.translate(W / 2 + cam.dx, H / 2 + cam.dy);
    ctx.rotate(cam.rot);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-W / 2, -H / 2);
    drawBase(t, W, H, 1.06);
  } else {
    // 従来の「背景の動き」設定
    const zoom = S.bgMotion === "zoom" ? 1 + 0.08 * (t / S.duration) : 1;
    if (S.bgMotion === "zoom") {
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H / 2);
    }
    drawBase(t, W, H, 1);
  }
  ctx.restore();

  // 暗さオーバーレイ（文字の可読性用）
  if (S.scrim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${S.scrim})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (S.bgMotion === "particles" || S.fx.overlays.includes("particles")) {
    drawParticles(t, W, H);
  }
  drawFxOverlays(t, W, H);
}

// パーティクル（下から上へ漂う光の粒・決定論的）
function drawParticles(t, W, H) {
  const sp = S.fx.speed;
  for (let i = 0; i < 45; i++) {
    const speed = (0.04 + rand(i) * 0.08) * sp;
    const x = rand(i * 3 + 1) * W + Math.sin(t * 1.2 + i) * 14;
    const yFrac = (rand(i * 7 + 2) - speed * t + 100) % 1;
    const y = yFrac * (H + 40) - 20;
    const r = 1.5 + rand(i * 11 + 3) * 3.5;
    const tw = 0.35 + 0.3 * Math.sin(t * 3 + i * 2.1); // またたき
    ctx.fillStyle = `rgba(255, 255, 255, ${tw})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// プロンプト演出のオーバーレイ群（すべて時刻 t から決定論的に描画）
function drawFxOverlays(t, W, H) {
  const ov = S.fx.overlays;
  if (ov.length === 0) return;
  const sp = S.fx.speed;
  const u = W / 720;

  if (ov.includes("rays")) {
    ctx.save();
    ctx.translate(W / 2, -H * 0.05);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9 - 0.5) * Math.PI * 0.9 + Math.sin(t * 0.4 * sp + k) * 0.05;
      const alpha = Math.max(0, 0.05 + 0.025 * Math.sin(t * 1.3 * sp + k * 1.8));
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255, 246, 214, ${alpha})`;
      ctx.fillRect(-W * 0.025, 0, W * 0.05, H * 1.5);
      ctx.restore();
    }
    ctx.restore();
  }

  if (ov.includes("bokeh")) {
    for (let i = 0; i < 14; i++) {
      const r = (25 + rand(i) * 55) * u;
      const x = rand(i * 3 + 1) * W + Math.sin(t * 0.3 * sp + i * 1.7) * 30 * u;
      const y = rand(i * 7 + 2) * H + Math.cos(t * 0.25 * sp + i) * 24 * u;
      const a = 0.05 + rand(i * 11 + 3) * 0.08;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (ov.includes("snow")) {
    for (let i = 0; i < 60; i++) {
      const fall = (0.06 + rand(i) * 0.08) * sp;
      const x = rand(i * 5 + 1) * W + Math.sin(t * 0.9 + i) * 25 * u;
      const y = ((rand(i * 7 + 2) + fall * t) % 1) * (H + 30) - 15;
      const r = (1.5 + rand(i * 11 + 3) * 3) * u;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + rand(i * 13 + 4) * 0.45})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (ov.includes("rain")) {
    ctx.save();
    ctx.strokeStyle = "rgba(200, 220, 255, 0.35)";
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const fall = (0.9 + rand(i) * 0.5) * sp;
      const x = ((rand(i * 3 + 1) + t * 0.03) % 1) * W;
      const y = ((rand(i * 7 + 2) + fall * t) % 1) * (H + 40) - 20;
      const len = (14 + rand(i * 11 + 3) * 10) * u;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4 * u, y + len);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (ov.includes("sakura")) {
    for (let i = 0; i < 28; i++) {
      const fall = (0.08 + rand(i) * 0.07) * sp;
      const x = rand(i * 5 + 1) * W + Math.sin(t * 1.1 + i) * 40 * u;
      const y = ((rand(i * 7 + 2) + fall * t) % 1) * (H + 60) - 30;
      const size = (5 + rand(i * 11 + 3) * 6) * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (1 + rand(i)) * 2 + i);
      ctx.fillStyle = "rgba(255, 183, 206, 0.85)";
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (ov.includes("sparkle")) {
    for (let i = 0; i < 26; i++) {
      const x = rand(i * 3 + 1) * W;
      const y = rand(i * 7 + 2) * H * 0.92;
      const tw = Math.sin(t * 2.2 * sp + rand(i) * Math.PI * 2);
      if (tw <= 0) continue;
      const a = Math.pow(tw, 3) * 0.9;
      const s = (3 + rand(i * 11 + 3) * 7) * u * tw;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath();
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ---------- テキスト描画 ----------

// テキスト登場アニメーションの alpha / offsetY / scale を返す
function introState(t, delay) {
  const introDur = Math.min(0.9, S.duration * 0.3);
  const p = clamp((t - delay) / introDur, 0, 1);
  switch (S.textAnim) {
    case "fade":    return { alpha: easeOutCubic(p), dy: 0, scale: 1 };
    case "slideup": return { alpha: easeOutCubic(p), dy: (1 - easeOutCubic(p)) * 60, scale: 1 };
    case "zoom":    return { alpha: easeOutCubic(p), dy: 0, scale: 0.8 + 0.2 * easeOutCubic(p) };
    case "pop":     return { alpha: clamp(p * 2, 0, 1), dy: 0, scale: p >= 1 ? 1 : easeOutBack(p) };
    default:        return { alpha: 1, dy: 0, scale: 1 };
  }
}

function drawTexts(t, W, H) {
  const u = W / 720; // 720px 基準のスケール係数
  const family = FONTS[S.font];
  const centerY = S.aspect === "9:16" ? H * 0.46 : H * 0.48;

  // --- メインテキスト（折り返し計算） ---
  const mainSize = S.fontSize * u;
  ctx.font = `700 ${mainSize}px ${family}`;
  const mainLines = wrapText(S.mainText, W * 0.86);
  const lineH = mainSize * 1.35;
  const blockH = mainLines.length * lineH;

  // タイプライターは全体の 55% の時間で1文字ずつ表示
  let visibleChars = Infinity;
  const totalChars = mainLines.join("").length;
  if (S.textAnim === "typewriter") {
    visibleChars = Math.floor(clamp(t / (S.duration * 0.55), 0, 1) * totalChars);
  }

  const main = S.textAnim === "typewriter"
    ? { alpha: 1, dy: 0, scale: 1 }
    : introState(t, 0);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(W / 2, centerY + main.dy * u);
  ctx.scale(main.scale, main.scale);
  ctx.globalAlpha = main.alpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 14 * u;
  ctx.shadowOffsetY = 3 * u;
  ctx.fillStyle = S.textColor;
  ctx.font = `700 ${mainSize}px ${family}`;

  let shown = 0;
  mainLines.forEach((line, i) => {
    let text = line;
    if (visibleChars !== Infinity) {
      const remain = Math.max(0, visibleChars - shown);
      text = [...line].slice(0, remain).join("");
      shown += [...line].length;
    }
    ctx.fillText(text, 0, -blockH / 2 + lineH * (i + 0.5));
  });
  ctx.restore();

  // --- サブテキスト（メインの少し後にフェードイン） ---
  if (S.subText.trim()) {
    const subDelay = S.textAnim === "typewriter" ? S.duration * 0.55 : 0.35;
    const sub = { ...introState(t, subDelay) };
    if (S.textAnim === "typewriter" || S.textAnim === "none") {
      const p = clamp((t - subDelay) / 0.5, 0, 1);
      sub.alpha = easeOutCubic(p); sub.dy = 0; sub.scale = 1;
    }
    const subSize = mainSize * 0.42;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = sub.alpha;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 8 * u;
    ctx.fillStyle = hexToRgba(S.textColor, 0.92);
    ctx.font = `500 ${subSize}px ${family}`;
    ctx.fillText(S.subText, W / 2, centerY + blockH / 2 + subSize * 1.6 + sub.dy * u * 0.5);
    ctx.restore();
  }

  // --- バッジ（上部・最初に降りてくる） ---
  if (S.badgeText.trim()) {
    const p = easeOutCubic(clamp(t / 0.5, 0, 1));
    const size = 26 * u;
    ctx.save();
    ctx.font = `700 ${size}px ${family}`;
    const tw = ctx.measureText(S.badgeText).width;
    const padX = 22 * u, padY = 12 * u;
    const bw = tw + padX * 2, bh = size + padY * 2;
    const bx = (W - bw) / 2;
    const by = H * 0.12 - bh / 2 - (1 - p) * 40 * u;
    ctx.globalAlpha = p;
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(S.badgeText, W / 2, by + bh / 2 + size * 0.05);
    ctx.restore();
  }
}

// ---------- フレーム合成 ----------

function drawFrame(t) {
  const W = canvas.width, H = canvas.height;
  drawBackground(t, W, H);
  drawTexts(t, W, H);

  if (S.progressBar) {
    const p = clamp(t / S.duration, 0, 1);
    const barH = Math.max(5, H * 0.007);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(0, H - barH, W * p, barH);
  }

  // ⚡ フラッシュ開始（プロンプト演出）
  if (S.fx.flash && t < 0.4) {
    const a = 1 - t / 0.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${a * a})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (S.fadeOut) {
    const fadeLen = Math.min(0.5, S.duration * 0.15);
    const p = clamp((t - (S.duration - fadeLen)) / fadeLen, 0, 1);
    if (p > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${p})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---------- プレビューループ ----------

function tick(now) {
  if (lastTick === null) lastTick = now;
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (playing) {
    playT += dt;
    if (!exporting && playT >= S.duration) playT %= S.duration; // プレビューはループ
  }

  drawFrame(Math.min(playT, S.duration));

  if (!exporting) {
    $("scrub").value = String(Math.round((playT / S.duration) * 1000));
    $("timeLabel").textContent = `${playT.toFixed(1)} / ${S.duration.toFixed(1)}s`;
  }
  requestAnimationFrame(tick);
}

// ---------- 書き出し ----------

function pickMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || null;
}

function exportVideo() {
  if (exporting) return;
  const mimeType = pickMimeType();
  if (!mimeType) {
    alert("このブラウザは動画の書き出し（MediaRecorder）に対応していません。\nChrome / Edge / Safari の最新版をお使いください。");
    return;
  }
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";

  exporting = true;
  playing = true;
  playT = 0;
  $("exportBtn").disabled = true;
  $("exportProgress").hidden = false;
  $("exportStatus").textContent = `書き出し中…（${ext.toUpperCase()} / 実時間で${S.duration.toFixed(1)}秒かかります）`;

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    // 日本語ファイル名は環境によって無視されるため ASCII のみ使用
    const now = new Date();
    const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, "0")).join("");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `short_${S.aspect.replace(":", "x")}_${S.duration}s_${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);

    exporting = false;
    playT = 0;
    $("exportBtn").disabled = false;
    $("exportProgress").hidden = true;
    $("exportStatus").textContent = `✅ 書き出し完了（${ext.toUpperCase()}）。ダウンロードフォルダをご確認ください。`;
  };

  recorder.onerror = () => {
    exporting = false;
    $("exportBtn").disabled = false;
    $("exportProgress").hidden = true;
    $("exportStatus").textContent = "⚠️ 書き出しに失敗しました。もう一度お試しください。";
  };

  recorder.start(200);

  // 進捗表示＆終了監視（描画自体は tick が担う）
  const started = performance.now();
  const watch = () => {
    const elapsed = (performance.now() - started) / 1000;
    const pct = Math.round(clamp(elapsed / S.duration, 0, 1) * 100);
    $("exportFill").style.width = `${pct}%`;
    $("exportPct").textContent = `${pct}%`;
    if (elapsed >= S.duration + 0.1) {
      recorder.stop();
      stream.getTracks().forEach((tr) => tr.stop());
    } else {
      requestAnimationFrame(watch);
    }
  };
  requestAnimationFrame(watch);
}

// ---------- AI動画生成（Google Veo / Gemini API） ----------

const AI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const AI_KEY_STORAGE = "vm_gemini_api_key";
const AI_POLL_MS = 8000;
const AI_TIMEOUT_MS = 8 * 60 * 1000;

let appMode = "template";
let aiBusy = false;
let aiResultBlob = null;   // fetch で取得できた場合
let aiResultLink = null;   // CORS で取得できない場合の直接リンク

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setAppMode(mode) {
  appMode = mode;
  document.querySelectorAll(".offlineOnly").forEach((el) => { el.hidden = mode === "ai"; });
  document.querySelectorAll(".aiOnly").forEach((el) => { el.hidden = mode !== "ai"; });
  canvas.hidden = mode === "ai";
}

function aiSetStatus(text, cls) {
  const el = $("aiStatus");
  el.textContent = text;
  el.className = "aiStatus" + (cls ? " " + cls : "");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function aiExplainError(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    if (j.error?.message) msg += `: ${j.error.message}`;
  } catch { /* 本文なし */ }
  if (res.status === 400 || res.status === 403) {
    msg += " — APIキーが正しいか確認してください（Google AI Studioで発行したキー）。";
  } else if (res.status === 429) {
    msg += " — レート上限または無料枠の上限です。Google AI Studio側の課金設定・クォータを確認してください。";
  }
  return msg;
}

async function generateAI() {
  if (aiBusy) return;
  const key = $("aiKey").value.trim();
  const prompt = $("aiPrompt").value.trim();
  if (!key) { aiSetStatus("APIキーを入力してください（Google AI Studioで無料発行できます）", "error"); return; }
  if (!prompt) { aiSetStatus("プロンプトを入力してください", "error"); return; }

  const model = $("aiModel").value;
  const negative = $("aiNegative").value.trim();
  const params = {
    aspectRatio: $("aiAspect").value,
    durationSeconds: Number($("aiDuration").value),
    resolution: $("aiResolution").value,
  };
  if (negative) params.negativePrompt = negative;

  const instance = { prompt };
  if ($("aiUseImage").checked && S.bgImageFile) {
    instance.image = {
      bytesBase64Encoded: await fileToBase64(S.bgImageFile),
      mimeType: S.bgImageFile.type,
    };
  }

  aiBusy = true;
  aiResultBlob = null;
  aiResultLink = null;
  $("aiGenerateBtn").disabled = true;
  $("aiSaveBtn").hidden = true;
  $("aiVideo").hidden = true;
  $("aiPlaceholder").hidden = false;
  const started = Date.now();

  try {
    aiSetStatus("リクエスト送信中…", "busy");
    const res = await fetch(`${AI_BASE}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [instance], parameters: params }),
    });
    if (!res.ok) throw new Error(await aiExplainError(res));
    const op = await res.json();
    if (!op.name) throw new Error("APIから操作IDが返りませんでした");

    // 完了までポーリング
    let result = null;
    while (true) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      if (elapsed * 1000 > AI_TIMEOUT_MS) throw new Error("タイムアウトしました（8分）。時間をおいて再試行してください");
      aiSetStatus(`生成中… ${elapsed}秒経過（通常1〜6分かかります。このタブは開いたままに）`, "busy");
      await sleep(AI_POLL_MS);
      const pr = await fetch(`${AI_BASE}/${op.name}`, { headers: { "x-goog-api-key": key } });
      if (!pr.ok) throw new Error(await aiExplainError(pr));
      const j = await pr.json();
      if (j.error) throw new Error(j.error.message || "生成に失敗しました");
      if (j.done) { result = j; break; }
    }

    const gvr = result.response?.generateVideoResponse;
    const uri =
      gvr?.generatedSamples?.[0]?.video?.uri ||
      gvr?.generatedVideos?.[0]?.video?.uri ||
      result.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      if (gvr?.raiMediaFilteredCount > 0) {
        const reason = gvr.raiMediaFilteredReasons?.[0] || "";
        throw new Error(`安全フィルタにより動画が生成されませんでした。プロンプトの表現を変えてお試しください。${reason}`);
      }
      throw new Error("動画URLを取得できませんでした（レスポンス形式が想定外です）");
    }

    // 動画の取得（fetch できない場合はキー付きURLで直接再生）
    aiSetStatus("動画をダウンロード中…", "busy");
    const keyedUrl = uri + (uri.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key);
    try {
      const vres = await fetch(uri, { headers: { "x-goog-api-key": key } });
      if (!vres.ok) throw new Error(`HTTP ${vres.status}`);
      aiResultBlob = await vres.blob();
      $("aiVideo").src = URL.createObjectURL(aiResultBlob);
    } catch {
      aiResultLink = keyedUrl;
      $("aiVideo").src = keyedUrl;
    }

    $("aiPlaceholder").hidden = true;
    $("aiVideo").hidden = false;
    $("aiVideo").play().catch(() => {});
    $("aiSaveBtn").hidden = false;
    const total = Math.round((Date.now() - started) / 1000);
    aiSetStatus(`✅ 生成完了（${total}秒）。プレビューを確認して保存してください`, "ok");
  } catch (err) {
    aiSetStatus(`⚠️ ${err.message || err}`, "error");
  } finally {
    aiBusy = false;
    $("aiGenerateBtn").disabled = false;
  }
}

function saveAIVideo() {
  const stamp = new Date().toISOString().slice(11, 19).replaceAll(":", "");
  if (aiResultBlob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(aiResultBlob);
    a.download = `veo_${$("aiAspect").value.replace(":", "x")}_${$("aiDuration").value}s_${stamp}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } else if (aiResultLink) {
    window.open(aiResultLink, "_blank"); // 新しいタブで開いて保存してもらう
  }
}

function bindAIControls() {
  document.querySelectorAll('input[name="appMode"]').forEach((r) => {
    r.addEventListener("change", (e) => setAppMode(e.target.value));
  });

  // APIキーはこの端末の localStorage にのみ保存
  $("aiKey").value = localStorage.getItem(AI_KEY_STORAGE) || "";
  $("aiKey").addEventListener("input", (e) => {
    localStorage.setItem(AI_KEY_STORAGE, e.target.value.trim());
  });

  // Veo 3.0 系は 8秒固定
  $("aiModel").addEventListener("change", (e) => {
    const isV30 = e.target.value.includes("3.0");
    if (isV30) $("aiDuration").value = "8";
    $("aiDuration").disabled = isV30;
  });

  $("aiGenerateBtn").addEventListener("click", generateAI);
  $("aiSaveBtn").addEventListener("click", saveAIVideo);
}

// ---------- UI 初期化 ----------

function applyAspect() {
  const { w, h } = ASPECTS[S.aspect];
  canvas.width = w;
  canvas.height = h;
}

function buildSwatches() {
  const wrap = $("swatches");
  GRADIENTS.forEach((g) => {
    const el = document.createElement("div");
    el.className = "swatch" + (g.id === S.gradient.id ? " selected" : "");
    el.style.background = `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`;
    el.innerHTML = `<span class="name">${g.name}</span>`;
    el.addEventListener("click", () => {
      S.gradient = g;
      wrap.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
      el.classList.add("selected");
    });
    wrap.appendChild(el);
  });
}

function bindControls() {
  $("aspect").addEventListener("change", (e) => { S.aspect = e.target.value; applyAspect(); });

  $("duration").addEventListener("input", (e) => {
    S.duration = parseFloat(e.target.value);
    $("durationLabel").textContent = `${S.duration.toFixed(1)}秒`;
    if (playT > S.duration) playT = 0;
  });

  $("mainText").addEventListener("input", (e) => { S.mainText = e.target.value; });
  $("subText").addEventListener("input", (e) => { S.subText = e.target.value; });
  $("badgeText").addEventListener("input", (e) => { S.badgeText = e.target.value; });
  $("font").addEventListener("change", (e) => { S.font = e.target.value; });
  $("fontSize").addEventListener("input", (e) => {
    S.fontSize = parseInt(e.target.value, 10);
    $("fontSizeLabel").textContent = String(S.fontSize);
  });
  $("textColor").addEventListener("input", (e) => { S.textColor = e.target.value; });
  $("textAnim").addEventListener("change", (e) => { S.textAnim = e.target.value; playT = 0; });

  document.querySelectorAll('input[name="bgType"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      S.bgType = e.target.value;
      $("gradientPane").hidden = S.bgType !== "gradient";
      $("solidPane").hidden = S.bgType !== "solid";
      $("imagePane").hidden = S.bgType !== "image";
    });
  });
  $("solidColor").addEventListener("input", (e) => { S.solidColor = e.target.value; });

  $("bgImage").addEventListener("change", (e) => loadImageFile(e.target.files[0]));

  // 画像の貼り付け（Ctrl+V）
  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      loadImageFile(item.getAsFile());
    }
  });

  // 画像のドラッグ&ドロップ（プレビュー上）
  const wrap = $("canvasWrap");
  ["dragover", "dragenter"].forEach((ev) =>
    wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add("dragging"); }));
  ["dragleave", "dragend"].forEach((ev) =>
    wrap.addEventListener(ev, () => wrap.classList.remove("dragging")));
  wrap.addEventListener("drop", (e) => {
    e.preventDefault();
    wrap.classList.remove("dragging");
    loadImageFile(e.dataTransfer.files[0]);
  });

  // プロンプト演出
  $("prompt").addEventListener("input", (e) => {
    S.prompt = e.target.value;
    S.fx = parsePrompt(S.prompt);
    renderFxChips();
  });

  $("bgMotion").addEventListener("change", (e) => { S.bgMotion = e.target.value; });
  $("scrim").addEventListener("input", (e) => {
    S.scrim = parseInt(e.target.value, 10) / 100;
    $("scrimLabel").textContent = `${e.target.value}%`;
  });
  $("progressBar").addEventListener("change", (e) => { S.progressBar = e.target.checked; });
  $("fadeOut").addEventListener("change", (e) => { S.fadeOut = e.target.checked; });

  $("playBtn").addEventListener("click", () => {
    if (exporting) return;
    playing = !playing;
    $("playBtn").textContent = playing ? "⏸" : "▶";
  });

  $("scrub").addEventListener("input", (e) => {
    if (exporting) return;
    playing = false;
    $("playBtn").textContent = "▶";
    playT = (parseInt(e.target.value, 10) / 1000) * S.duration;
  });

  $("exportBtn").addEventListener("click", exportVideo);
}

// 画像ファイルを読み込んで背景に設定（ファイル選択・貼り付け・ドロップ共通）
function loadImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  img.onload = () => {
    S.bgImage = img;
    S.bgImageFile = file; // AIモードの image-to-video 用に元ファイルも保持
    const radio = document.querySelector('input[name="bgType"][value="image"]');
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
    const label = `✅ ${file.name || "貼り付け画像"}（${img.width}×${img.height}）`;
    $("imageHint").textContent = label;
    $("aiImageHint").textContent = label + " — image-to-video に使えます";
    $("aiUseImageWrap").hidden = false;
  };
  img.src = URL.createObjectURL(file);
}

function init() {
  S.mainText = $("mainText").value;
  S.subText = $("subText").value;
  S.badgeText = $("badgeText").value;
  S.prompt = $("prompt").value;
  S.fx = parsePrompt(S.prompt);
  applyAspect();
  buildSwatches();
  bindControls();
  bindAIControls();
  requestAnimationFrame(tick);
}

init();
