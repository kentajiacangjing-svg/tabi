import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RouteLoading } from "@/components/route-loading";
import { isDemo } from "@/lib/demo";

export const metadata: Metadata = {
  title: { default: "SUMATCH（スマッチ）— 探す・比べる・決めるを、ひとつに。", template: "%s | SUMATCH" },
  description: "家の困りごとを無料で相談。条件に合う会社だけと、アプリ内でやり取り・見積比較・依頼先決定まで。営業電話だらけにならないマッチングサービス。",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // the on-screen keyboard shrinks the layout instead of covering the message box (Android Chrome)
  interactiveWidget: "resizes-content",
  themeColor: "#f7f7f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-demo={isDemo() ? "" : undefined}>
      <head>
        {/* a photo that fails to load keeps its placeholder background instead of a broken-image icon */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="IMG")t.classList.add("img-broken")},true);`,
          }}
        />
      </head>
      <body>
        {children}
        <RouteLoading />

      </body>
    </html>
  );
}
