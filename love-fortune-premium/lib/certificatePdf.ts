import type { PremiumFortuneResult } from "@/types/fortune";
import { FORTUNE_SECTION_ORDER } from "@/types/fortune";
import { premiumSectionTitles } from "@/lib/fortune/premiumTemplates";
import { appConfig } from "@/config/app";

/**
 * 占い結果を「恋愛鑑定書」としてA4のPDFに組む。
 * 各ページをcanvasで描画（端末のフォントで日本語を描けるため、
 * PDFへの日本語フォント埋め込みが不要になる）し、jsPDFで束ねる。
 * すべて端末内で完結し、内容はどこにも送信されない。
 */

// A4 150dpi 相当
const W = 1240;
const H = 1754;
const MARGIN_X = 150;
const TOP = 150;
const BOTTOM = 170;
const CONTENT_W = W - MARGIN_X * 2;

const COLORS = {
  bgTop: "#171226",
  bgBottom: "#241c3d",
  panel: "#262040",
  line: "#3d3560",
  gold: "#d8b25f",
  goldFaint: "rgba(216, 178, 95, 0.45)",
  text: "#f4eee4",
  textSoft: "#beb6c9",
};

const SANS =
  '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';
const SERIF =
  '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Serif CJK JP", serif';

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    if (ctx.measureText(current + ch).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** ページの下地（夜空・金の二重枠・四隅の星）を描く */
function drawPageBase(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = COLORS.goldFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  drawStar(ctx, 100, 100, 12, COLORS.gold);
  drawStar(ctx, W - 100, 100, 12, COLORS.gold);
  drawStar(ctx, 100, H - 100, 12, COLORS.gold);
  drawStar(ctx, W - 100, H - 100, 12, COLORS.gold);
}

/** ページをまたぐ文章の流し込みを管理する */
class CertificateBuilder {
  pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private y = TOP;

  constructor() {
    this.newPage();
  }

  newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("この環境ではPDFを生成できません。");
    drawPageBase(ctx);
    this.pages.push(canvas);
    this.ctx = ctx;
    this.y = TOP;
  }

  /** 高さが収まらなければ改ページする */
  ensure(height: number) {
    if (this.y + height > H - BOTTOM) this.newPage();
  }

  space(px: number) {
    this.y += px;
  }

  centerText(
    text: string,
    font: string,
    color: string,
    lineHeight: number,
    letterSpacing = 0,
  ) {
    this.ensure(lineHeight);
    const ctx = this.ctx;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    if (letterSpacing > 0) {
      // 英字の飾り見出し用の簡易字間
      const chars = [...text];
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total =
        widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
      let x = W / 2 - total / 2;
      chars.forEach((c, i) => {
        ctx.textAlign = "left";
        ctx.fillText(c, x, this.y + lineHeight * 0.75);
        x += widths[i] + letterSpacing;
      });
      ctx.textAlign = "center";
    } else {
      ctx.fillText(text, W / 2, this.y + lineHeight * 0.75);
    }
    this.y += lineHeight;
  }

  /** 中央にひし形の飾りが入った区切り線 */
  divider() {
    this.ensure(48);
    const ctx = this.ctx;
    const cy = this.y + 24;
    ctx.strokeStyle = COLORS.goldFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X + 60, cy);
    ctx.lineTo(W / 2 - 30, cy);
    ctx.moveTo(W / 2 + 30, cy);
    ctx.lineTo(W - MARGIN_X - 60, cy);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    this.y += 48;
  }

  /** セクション見出し（改ページ時に本文1行分と泣き別れしないよう確保） */
  heading(text: string) {
    this.ensure(120);
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.gold;
    ctx.save();
    ctx.translate(MARGIN_X + 10, this.y + 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.font = `bold 32px ${SERIF}`;
    ctx.textAlign = "left";
    ctx.fillText(text, MARGIN_X + 36, this.y + 44);
    ctx.strokeStyle = COLORS.goldFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, this.y + 64);
    ctx.lineTo(W - MARGIN_X, this.y + 64);
    ctx.stroke();
    this.y += 88;
  }

  paragraph(text: string, options?: { color?: string; indent?: number }) {
    const ctx = this.ctx;
    const indent = options?.indent ?? 0;
    ctx.font = `26px ${SANS}`;
    const lines = wrap(ctx, text, CONTENT_W - indent);
    for (const line of lines) {
      this.ensure(46);
      ctx.font = `26px ${SANS}`;
      ctx.fillStyle = options?.color ?? COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(line, MARGIN_X + indent, this.y + 34);
      this.y += 46;
    }
  }

  subLabel(text: string) {
    this.ensure(44);
    const ctx = this.ctx;
    ctx.font = `bold 26px ${SANS}`;
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = "left";
    ctx.fillText(text, MARGIN_X, this.y + 32);
    this.y += 44;
  }

  /** 表紙のカード3枚ブロック */
  cardTrio(result: PremiumFortuneResult) {
    const boxH = 210;
    this.ensure(boxH + 20);
    const ctx = this.ctx;
    const boxW = (CONTENT_W - 60) / 3;
    const entries = [
      { label: "過去", card: result.cards.past },
      { label: "現在", card: result.cards.present },
      { label: "未来", card: result.cards.future },
    ];
    entries.forEach(({ label, card }, i) => {
      const x = MARGIN_X + i * (boxW + 30);
      ctx.fillStyle = COLORS.panel;
      ctx.strokeStyle = COLORS.goldFaint;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, this.y, boxW, boxH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "center";
      const cx = x + boxW / 2;
      ctx.fillStyle = COLORS.gold;
      ctx.font = `22px ${SANS}`;
      ctx.fillText(label, cx, this.y + 44);

      // 三日月のモチーフ
      ctx.beginPath();
      ctx.arc(cx + 5, this.y + 92, 24, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.gold;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 7, this.y + 88, 21, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.panel;
      ctx.fill();

      ctx.fillStyle = COLORS.text;
      ctx.font = `bold 34px ${SERIF}`;
      ctx.fillText(card.name, cx, this.y + 158);
      ctx.fillStyle = COLORS.textSoft;
      ctx.font = `22px ${SANS}`;
      ctx.fillText(card.keyword, cx, this.y + 192);
    });
    this.y += boxH + 20;
  }

  /** 全ページ確定後にフッター（ページ番号）を焼き込む */
  finalize() {
    this.pages.forEach((canvas, i) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = `20px ${SANS}`;
      ctx.fillStyle = COLORS.textSoft;
      ctx.textAlign = "center";
      ctx.fillText(
        `${appConfig.appName} — ${i + 1} / ${this.pages.length}`,
        W / 2,
        H - 78,
      );
    });
  }
}

function formatJpDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 鑑定書のページ一式をcanvasで組み立てる */
export function buildCertificatePages(
  result: PremiumFortuneResult,
  now: Date = new Date(),
): HTMLCanvasElement[] {
  const b = new CertificateBuilder();

  // ---- 表紙ヘッダー ----
  b.space(40);
  b.centerText("LOVE FORTUNE READING", `24px ${SANS}`, COLORS.gold, 36, 10);
  b.space(18);
  b.centerText("恋 愛 鑑 定 書", `bold 78px ${SERIF}`, COLORS.text, 96);
  b.space(6);
  b.centerText(appConfig.appName, `26px ${SANS}`, COLORS.textSoft, 40);
  b.space(10);
  b.divider();
  b.space(14);

  b.centerText(
    `${result.nickname} さま`,
    `bold 40px ${SERIF}`,
    COLORS.text,
    56,
  );
  const meta: string[] = [
    `鑑定日：${formatJpDate(now)}`,
    `占題：${result.themeLabel}`,
    `導きの数：${result.destinyNumber}`,
  ];
  b.space(6);
  b.centerText(meta.join("　／　"), `24px ${SANS}`, COLORS.textSoft, 40);
  b.space(30);

  // ---- カード ----
  b.cardTrio(result);
  b.space(20);

  // ---- 本文セクション ----
  b.heading(premiumSectionTitles.cards);
  (
    [
      ["過去", result.cards.past, "past"],
      ["現在", result.cards.present, "present"],
      ["未来", result.cards.future, "future"],
    ] as const
  ).forEach(([label, card, pos]) => {
    b.subLabel(`${label}｜${card.name} — ${card.keyword}`);
    b.paragraph(card.meanings[pos]);
    b.space(14);
  });
  b.space(10);

  for (const key of FORTUNE_SECTION_ORDER) {
    const section = result.sections[key];

    // 「障害」の後に縁、「変化」の前にタイムラインを差し込む（画面と同じ流れ）
    if (key === "obstacle") {
      const bond = result.bond;
      b.heading(
        bond.kind === "pair"
          ? premiumSectionTitles.bondPair
          : premiumSectionTitles.bondSelf,
      );
      b.subLabel(
        bond.kind === "pair"
          ? `縁の数 ${bond.pairNumber}「${bond.title}」`
          : `「${bond.title}」`,
      );
      b.paragraph(bond.body);
      b.space(10);
    }

    b.heading(section.title);
    for (const paragraph of section.body.split("\n\n")) {
      b.paragraph(paragraph);
      b.space(8);
    }
    b.space(10);

    if (key === "obstacle") {
      b.heading(premiumSectionTitles.timeline);
      for (const entry of result.timeline) {
        b.subLabel(entry.label);
        b.paragraph(entry.body);
        b.space(12);
      }
      b.space(10);
    }
  }

  // ---- ラッキーチャーム ----
  b.heading(premiumSectionTitles.lucky);
  b.paragraph(`色：${result.lucky.color}`);
  b.paragraph(`もの：${result.lucky.item}`);
  b.paragraph(`曜日：${result.lucky.day}`);
  b.paragraph(`おまじない：${result.lucky.action}`);
  b.space(24);

  // ---- 結び ----
  b.divider();
  b.space(10);
  if (appConfig.distributor.name) {
    b.centerText(
      `監修：${appConfig.distributor.name}`,
      `24px ${SANS}`,
      COLORS.textSoft,
      40,
    );
    b.space(6);
  }
  b.paragraph(
    "本鑑定書は、エンターテインメントとしてお楽しみいただく参考情報です。未来や相手の気持ちを保証するものではありません。医療・法律・お金・安全に関わる大切な判断には、専門家の助言をご利用ください。",
    { color: COLORS.textSoft },
  );

  b.finalize();
  return b.pages;
}

/** 鑑定書PDFを保存（可能なら共有シート、だめならダウンロード） */
export async function saveCertificatePdf(
  result: PremiumFortuneResult,
): Promise<"shared" | "downloaded"> {
  // jspdfは鑑定書を作るときだけ読み込む（初期表示を重くしないため）
  const { jsPDF } = await import("jspdf");

  const pages = buildCertificatePages(result);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pages.forEach((canvas, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 210, 297);
  });

  const blob = pdf.output("blob");
  const file = new File([blob], "koi-no-shirube-kanteisho.pdf", {
    type: "application/pdf",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: appConfig.appName });
      return "shared";
    } catch {
      // 共有シートを閉じただけの可能性があるため、ダウンロードへ切り替える
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "koi-no-shirube-kanteisho.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
