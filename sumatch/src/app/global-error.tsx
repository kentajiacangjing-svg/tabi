"use client";

import "./globals.css";
import { ErrorState } from "@/components/error-state";

/** Last resort when even the root layout fails. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body className="px-5">
        <ErrorState reset={reset} />
      </body>
    </html>
  );
}
