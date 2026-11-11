import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const OPTIONS_PATH = "/data/options.json";

export const OPTION_ENVIRONMENT = {
  admin_username: "ADMIN_USERNAME",
  admin_password: "ADMIN_PASSWORD",
  timezone: "TZ",
  markets_provider: "MARKETS_PROVIDER",
  finnhub_api_key: "FINNHUB_API_KEY",
  twelve_data_api_key: "TWELVE_DATA_API_KEY",
  twelve_data_refresh_minutes: "TWELVE_DATA_REFRESH_MINUTES",
  twelve_data_max_symbols: "TWELVE_DATA_MAX_SYMBOLS",
  roomos_device_ip: "ROOMOS_DEVICE_IP",
  roomos_username: "ROOMOS_USERNAME",
  roomos_password: "ROOMOS_PASSWORD",
  roomos_protocol: "ROOMOS_PROTOCOL",
  roomos_insecure_tls: "ROOMOS_INSECURE_TLS",
  newsroom_url: "NEWSROOM_URL",
};

export function readHomeAssistantOptions(optionsPath = OPTIONS_PATH) {
  if (!existsSync(optionsPath)) return {};
  try {
    return JSON.parse(readFileSync(optionsPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid Home Assistant options: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function applyHomeAssistantOptions(options, env = process.env) {
  for (const [option, environment] of Object.entries(OPTION_ENVIRONMENT)) {
    const value = options[option];
    if (value === undefined || value === null || String(value).length === 0) continue;
    env[environment] = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  }
  return env;
}

export function ensureSessionSecret(dataDir, env = process.env) {
  mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, "session-secret");
  if (!env.SESSION_SECRET) {
    if (!existsSync(secretPath)) {
      writeFileSync(secretPath, randomBytes(32).toString("hex"), { mode: 0o600 });
    }
    env.SESSION_SECRET = readFileSync(secretPath, "utf8").trim();
  }
  return env.SESSION_SECRET;
}

export function requireAdminPassword(env = process.env) {
  const password = env.ADMIN_PASSWORD;
  if (!password || password.trim().length < 8) {
    throw new Error(
      "Set the administrator password (at least 8 characters) in the Home Assistant Configuration tab. No .env file is used on Home Assistant OS.",
    );
  }
}
