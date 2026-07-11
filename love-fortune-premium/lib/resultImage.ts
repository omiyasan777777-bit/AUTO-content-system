import type { PremiumFortuneResult } from "@/types/fortune";
import { appConfig } from "@/config/app";

/**
 * 占い結果をスマホ保存用の画像（PNG）としてcanvasで描画する。
 * 個人の相談内容は載せず、カード・キーメッセージ・ラッキーチャームに絞る。
 */

const W = 1080;
const H = 1350;

const COLORS = {
  bgTop: "#171226",
  bgBottom: "#241c3d",
  card: "#262040",
  line: "#3d3560",
  gold: "#d8b25f",
  text: "#f4eee4",
  textSoft: "#beb6c9",
};

const FONT = '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** 文字数ベースの簡易折り返し（日本語向け） */
function wrapText(
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
) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function renderResultImage(result: PremiumFortuneResult): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("この環境では画像を生成できません。");

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星の装飾
  ctx.fillStyle = "rgba(216, 178, 95, 0.5)";
  drawStar(ctx, 120, 150, 14);
  drawStar(ctx, 960, 220, 10);
  drawStar(ctx, 180, 1180, 10);
  drawStar(ctx, 930, 1120, 13);

  // 金の枠
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";

  // ヘッダー
  ctx.fillStyle = COLORS.gold;
  ctx.font = `28px ${FONT}`;
  ctx.fillText("Y O U R  F O R T U N E", W / 2, 140);

  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 64px ${SERIF}`;
  ctx.fillText(appConfig.appName, W / 2, 230);

  ctx.fillStyle = COLORS.textSoft;
  ctx.font = `32px ${FONT}`;
  ctx.fillText(`${result.nickname}さんの「${result.themeLabel}」`, W / 2, 300);

  // カード3枚
  const cardW = 280;
  const cardH = 360;
  const gap = 40;
  const startX = (W - cardW * 3 - gap * 2) / 2;
  const cardY = 370;
  const positions = [
    { label: "過去", card: result.cards.past },
    { label: "現在", card: result.cards.present },
    { label: "未来", card: result.cards.future },
  ];
  positions.forEach(({ label, card }, i) => {
    const x = startX + i * (cardW + gap);
    ctx.fillStyle = COLORS.card;
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.gold;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(label, x + cardW / 2, cardY + 60);

    // 月のモチーフ
    ctx.beginPath();
    ctx.arc(x + cardW / 2, cardY + 150, 44, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(216, 178, 95, 0.18)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + cardW / 2 + 8, cardY + 146, 34, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + cardW / 2 - 10, cardY + 140, 30, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.card;
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 40px ${SERIF}`;
    ctx.fillText(card.name, x + cardW / 2, cardY + 260);
    ctx.fillStyle = COLORS.textSoft;
    ctx.font = `28px ${FONT}`;
    ctx.fillText(card.keyword, x + cardW / 2, cardY + 310);
  });

  // キーメッセージ（最後の恋愛メッセージの結び部分）
  const paragraphs = result.sections.message.body.split("\n\n");
  const closing = paragraphs[paragraphs.length - 1];
  ctx.fillStyle = COLORS.gold;
  ctx.font = `30px ${FONT}`;
  ctx.fillText("― 今夜のことば ―", W / 2, 850);

  ctx.fillStyle = COLORS.text;
  ctx.font = `34px ${SERIF}`;
  const lines = wrapText(ctx, closing, W - 220);
  lines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, W / 2, 920 + i * 56);
  });

  // ラッキーチャーム
  const luckyY = 1170;
  ctx.fillStyle = COLORS.gold;
  ctx.font = `30px ${FONT}`;
  ctx.fillText("LUCKY CHARM", W / 2, luckyY - 60);
  ctx.fillStyle = COLORS.textSoft;
  ctx.font = `30px ${FONT}`;
  ctx.fillText(
    `色 ${result.lucky.color} ／ もの ${result.lucky.item} ／ ${result.lucky.day}`,
    W / 2,
    luckyY,
  );

  // フッター
  ctx.fillStyle = COLORS.textSoft;
  ctx.font = `26px ${FONT}`;
  ctx.fillText(appConfig.footerText, W / 2, H - 80);

  return canvas;
}

/** 画像を保存（可能なら共有シート、だめならダウンロード） */
export async function saveResultImage(
  result: PremiumFortuneResult,
): Promise<"shared" | "downloaded"> {
  const canvas = renderResultImage(result);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("画像の生成に失敗しました。"))),
      "image/png",
    );
  });

  const file = new File([blob], "koi-no-shirube.png", { type: "image/png" });
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
  a.download = "koi-no-shirube.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
