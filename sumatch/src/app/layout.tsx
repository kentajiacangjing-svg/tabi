import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SUMATCH（スマッチ）— 探す・比べる・決めるを、ひとつに。", template: "%s | SUMATCH" },
  description: "家の困りごとを無料で相談。条件に合う会社だけと、アプリ内でやり取り・見積比較・契約まで。営業電話だらけにならないマッチングサービス。",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
