import { createHash, createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { sessionSecret } from "@/lib/config";
import { getDb, getSetting, setSetting } from "@/lib/database";

export const PULSE_DISPLAY_COOKIE = "nr_pulse_display";
export const PULSE_PAIRING_REQUESTER_COOKIE = "nr_pulse_pairing_requester";
const MAX_AGE = 60 * 60 * 24 * 30;
const PAIRING_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_ACTIVE_PAIRINGS = 50;

function key() {
  return new TextEncoder().encode(sessionSecret());
}

function displayGeneration() {
  const parsed = Number(getSetting("health_display_generation", "1"));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function codeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function requesterHash(requesterToken: string) {
  return createHmac("sha256", sessionSecret())
    .update(requesterToken)
    .digest("hex");
}

function pairingCode(id: string) {
  const digest = createHmac("sha256", sessionSecret()).update(id).digest();
  return String(100000 + (digest.readUInt32BE(0) % 900000));
}

export async function createPulseDisplayToken() {
  return new SignJWT({
    purpose: "pulse-display",
    generation: displayGeneration(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("newsroom55")
    .setAudience("pulse-display")
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifyPulseDisplayRequest(req: NextRequest) {
  const token = req.cookies.get(PULSE_DISPLAY_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "newsroom55",
      audience: "pulse-display",
    });
    return (
      payload.purpose === "pulse-display" &&
      payload.generation === displayGeneration()
    );
  } catch {
    return false;
  }
}

export function createPulseDisplayPairing(requesterToken: string) {
  const database = getDb();
  const now = new Date();
  const requester = requesterHash(requesterToken);
  database
    .prepare("DELETE FROM health_display_pairings WHERE expires_at <= ?")
    .run(now.toISOString());
  const existing = database
    .prepare(
      `SELECT id, created_at as createdAt, expires_at as expiresAt
       FROM health_display_pairings WHERE requester_hash = ?`,
    )
    .get(requester) as
    | { id: string; createdAt: string; expiresAt: string }
    | undefined;
  if (existing) {
    return { ...existing, code: pairingCode(existing.id) };
  }
  const active = database
    .prepare("SELECT COUNT(*) as count FROM health_display_pairings")
    .get() as { count: number };
  if (active.count >= MAX_ACTIVE_PAIRINGS) {
    throw new Error("Trop de demandes d’association actives");
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = randomUUID();
    const code = pairingCode(id);
    const pairing = {
      id,
      code,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PAIRING_MAX_AGE_MS).toISOString(),
    };
    try {
      database
        .prepare(
          `INSERT INTO health_display_pairings
            (id, requester_hash, code_hash, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          pairing.id,
          requester,
          codeHash(pairing.code),
          pairing.createdAt,
          pairing.expiresAt,
        );
      return pairing;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("UNIQUE")) {
        throw error;
      }
    }
  }
  throw new Error("Impossible de créer un code d’association");
}

export function attachPulsePairingRequesterCookie(
  response: NextResponse,
  requesterToken: string,
  secure: boolean,
) {
  response.cookies.set(PULSE_PAIRING_REQUESTER_COOKIE, requesterToken, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/api/pulse/display-pairing",
    maxAge: MAX_AGE,
  });
}

export function approvePulseDisplayPairing(input: string) {
  const code = input.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE health_display_pairings
       SET approved = 1, approved_at = ?
       WHERE code_hash = ? AND approved = 0 AND expires_at > ?`,
    )
    .run(now, codeHash(code), now);
  return result.changes === 1;
}

export function consumePulseDisplayPairing(id: string) {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT approved, expires_at as expiresAt
       FROM health_display_pairings WHERE id = ?`,
    )
    .get(id) as { approved: number; expiresAt: string } | undefined;
  if (!row) return "missing" as const;
  if (row.expiresAt <= new Date().toISOString()) {
    database.prepare("DELETE FROM health_display_pairings WHERE id = ?").run(id);
    return "expired" as const;
  }
  if (!row.approved) return "pending" as const;
  database.prepare("DELETE FROM health_display_pairings WHERE id = ?").run(id);
  return "approved" as const;
}

export function revokePulseDisplays() {
  const database = getDb();
  database.transaction(() => {
    setSetting("health_display_generation", String(displayGeneration() + 1));
    database.prepare("DELETE FROM health_display_pairings").run();
  })();
}

export function attachPulseDisplayCookie(
  response: NextResponse,
  token: string,
  secure: boolean,
) {
  response.cookies.set(PULSE_DISPLAY_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearPulseDisplayCookie(response: NextResponse) {
  response.cookies.set(PULSE_DISPLAY_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
