import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { adminPassword, adminUsername, sessionSecret } from "@/lib/config";
import { getDb } from "@/lib/database";
import { randomBytes } from "crypto";

const COOKIE = "nr_session";
const MAX_AGE = 60 * 60 * 12;

function secretKey() {
  return new TextEncoder().encode(sessionSecret());
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function ensureAdminUser(): Promise<void> {
  const password = adminPassword();
  const db = getDb();
  if (!password) {
    const row = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(adminUsername()) as
      | { id: number }
      | undefined;
    if (!row) {
      console.warn("[newsroom55] ADMIN_PASSWORD is not set; /admin login has no default user.");
    }
    return;
  }
  const hash = await hashPassword(password);
  db.prepare(
    `INSERT INTO admin_users (username, password_hash)
     VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
  ).run(adminUsername(), hash);
  db.prepare("DELETE FROM admin_users WHERE username <> ?").run(adminUsername());
}

export async function createSession(username: string): Promise<{ token: string; csrf: string }> {
  const csrf = randomBytes(16).toString("hex");
  const token = await new SignJWT({ sub: username, csrf })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  return { token, csrf };
}

export async function readSession(): Promise<{ username: string; csrf: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.sub !== "string" ||
      payload.sub !== adminUsername() ||
      typeof payload.csrf !== "string"
    ) {
      return null;
    }
    return { username: payload.sub, csrf: payload.csrf };
  } catch {
    return null;
  }
}

export function attachSessionCookie(res: NextResponse, token: string, secure: boolean) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
}

export async function requireAdmin(req: NextRequest): Promise<
  | { ok: true; username: string }
  | { ok: false; response: NextResponse }
> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.sub !== "string" ||
      payload.sub !== adminUsername() ||
      typeof payload.csrf !== "string"
    ) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      const header = req.headers.get("x-csrf-token");
      if (!header || header !== payload.csrf) {
        return { ok: false, response: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }) };
      }
    }
    return { ok: true, username: payload.sub };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function loginUser(username: string, password: string): Promise<boolean> {
  const db = getDb();
  const row = db.prepare("SELECT password_hash FROM admin_users WHERE username = ?").get(username) as
    | { password_hash: string }
    | undefined;
  if (!row) return false;
  return verifyPassword(password, row.password_hash);
}
