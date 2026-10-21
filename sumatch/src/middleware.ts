import { NextResponse, type NextRequest } from "next/server";
import { noIndex, siteGateAllows } from "@/lib/site-gate";

// Fast first gate: pages that always need a session redirect to /login when no cookie is present.
// Authorization (role, ownership) is enforced again on the server for every page, action and API route.
const PROTECTED = [/^\/projects/, /^\/matches/, /^\/messages/, /^\/quotes/, /^\/account/, /^\/notifications/, /^\/admin/, /^\/business\/(dashboard|leads|messages|quotes|profile)/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Limited test: the whole site behind a shared password (lib/site-gate.ts).
  if (siteGateAllows(req.headers.get("authorization")) === false) {
    return new NextResponse("SUMATCH は限定テスト中です。", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="SUMATCH", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
    });
  }
  if (PROTECTED.some((r) => r.test(pathname)) && !req.cookies.get("sm_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (noIndex()) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/((?!api|_next|seed|icon.svg|favicon.ico).*)"] };
