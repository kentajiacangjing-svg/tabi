"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/**
 * Navigation in progress: a thin bar under the header. It starts on an in-app link click and stops when
 * the new URL renders; CSS keeps it invisible for the first ~0.3s, so fast pages never show it.
 * (A `loading.tsx` would do this too, but it makes Next stream pages and turns 404s into 200s.)
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!active) return null;
  return (
    <div className="route-loading" role="progressbar" aria-label="読み込み中" aria-busy="true">
      <span />
    </div>
  );
}

export function RouteLoading() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
