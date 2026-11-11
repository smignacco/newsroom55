import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { attachSessionCookie, createSession, loginUser } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  await boot();
  // The app is exposed directly on its Home Assistant port, so forwarded IP
  // headers are not trusted. There is one configured administrator account.
  if (!rateLimit("login:administrator", 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const ok = await loginUser(parsed.data.username, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const { token, csrf } = await createSession(parsed.data.username);
  const res = NextResponse.json({ ok: true, csrf });
  attachSessionCookie(res, token, req.nextUrl.protocol === "https:");
  return res;
}
