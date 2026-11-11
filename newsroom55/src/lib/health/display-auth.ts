import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { sessionSecret } from "@/lib/config";

export const PULSE_DISPLAY_COOKIE = "nr_pulse_display";
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  return new TextEncoder().encode(sessionSecret());
}

export async function createPulseDisplayToken() {
  return new SignJWT({ purpose: "pulse-display" })
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
    return payload.purpose === "pulse-display";
  } catch {
    return false;
  }
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
