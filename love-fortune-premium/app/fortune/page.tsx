import type { Metadata } from "next";
import { FortuneFlow } from "@/components/fortune/FortuneFlow";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "恋愛を占う",
  description:
    "気になるテーマを選んで、あなたと相手のことを教えてください。今のあなたに必要なメッセージをお届けします。",
  // 入力途中の画面のため検索結果には出さない
  robots: { index: false, follow: true },
};

export default function FortunePage() {
  return (
    <>
      <main className="flex flex-1 flex-col">
        <FortuneFlow />
      </main>
      <Footer />
    </>
  );
}
