import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.siteUrl),
  title: {
    default: `${appConfig.appName}｜恋愛占い`,
    template: `%s｜${appConfig.appName}`,
  },
  description: appConfig.description,
  alternates: {
    // NEXT_PUBLIC_SITE_URL を設定すると canonical が本番URLになる
    canonical: "/",
  },
  openGraph: {
    title: `${appConfig.appName}｜恋愛占い`,
    description: appConfig.description,
    url: "/",
    siteName: appConfig.appName,
    locale: "ja_JP",
    type: "website",
    // 画像を差し替える場合は public/og.png を置き換える
    // （assets/og-template.html を編集してブラウザで1200x630で撮り直せる）
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${appConfig.appName}｜恋愛占い`,
    description: appConfig.description,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
