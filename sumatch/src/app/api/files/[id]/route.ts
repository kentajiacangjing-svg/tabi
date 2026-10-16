import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReadFile } from "@/lib/access";
import { readStoredFile } from "@/lib/files";
import type { FileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = get<FileRow>("SELECT * FROM files WHERE id = ?", id);
  const user = await getCurrentUser();
  if (!file || !canReadFile(user, file)) return new NextResponse("Not found", { status: 404 });
  let data: Buffer;
  try {
    data = readStoredFile(file);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const download = new URL(req.url).searchParams.has("download");
  const name = encodeURIComponent(file.original_name);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": file.scope === "public" ? "public, max-age=86400" : "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Uploaded content is never allowed to run scripts.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
