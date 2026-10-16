import { NextResponse, type NextRequest } from "next/server";

// Fast first gate: pages that always need a session redirect to /login when no cookie is present.
// Authorization (role, ownership) is enforced again on the server for every page, action and API route.
const PROTECTED = [/^\/projects/, /^\/matches/, /^\/messages/, /^\/quotes/, /^\/account/, /^\/notifications/, /^\/admin/, /^\/business\/(dashboard|leads|messages|quotes|profile)/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED.some((r) => r.test(pathname)) && !req.cookies.get("sm_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|seed|icon.svg|favicon.ico).*)"] };
