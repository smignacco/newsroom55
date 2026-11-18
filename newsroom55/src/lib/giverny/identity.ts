import { getSetting } from "@/lib/database";
import { EDGAR_CONTACT_EMAIL } from "@/lib/giverny/types";

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function isContactEmail(value: string): boolean {
  return EMAIL.test(value) && value.length <= 120;
}

export function edgarContactEmail(): string {
  const env = (process.env.EDGAR_CONTACT_EMAIL || "").trim();
  if (isContactEmail(env)) return env;
  try {
    const stored = getSetting("giverny_edgar_contact", "").trim();
    if (isContactEmail(stored)) return stored;
  } catch {
    // SQLite may not be open yet during isolated HTTP tests.
  }
  return EDGAR_CONTACT_EMAIL;
}

export function secUserAgent(contact = edgarContactEmail()): string {
  const override = (process.env.EDGAR_USER_AGENT || "").trim();
  if (override) return override.slice(0, 250);
  return `NEWSROOM55 GivernyTracker ${contact}`;
}
