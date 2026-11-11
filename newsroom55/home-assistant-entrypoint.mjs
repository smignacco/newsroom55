import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chownSync,
  existsSync,
  lchownSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || "/app/data";
const optionsPath = "/data/options.json";

function readOptions() {
  if (!existsSync(optionsPath)) return {};
  try {
    return JSON.parse(readFileSync(optionsPath, "utf8"));
  } catch (error) {
    console.error(
      "[newsroom55] Invalid Home Assistant options:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

const options = readOptions();
const optionEnvironment = {
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
};

for (const [option, environment] of Object.entries(optionEnvironment)) {
  const value = options[option];
  if (value !== undefined && value !== null && String(value).length > 0) {
    process.env[environment] = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  }
}

mkdirSync(dataDir, { recursive: true });
const secretPath = path.join(dataDir, "session-secret");
if (!process.env.SESSION_SECRET) {
  if (!existsSync(secretPath)) {
    writeFileSync(secretPath, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  process.env.SESSION_SECRET = readFileSync(secretPath, "utf8").trim();
}

let command = "node";
let args = ["server.js"];
if (process.getuid?.() === 0) {
  const account = readFileSync("/etc/passwd", "utf8")
    .split("\n")
    .find((line) => line.startsWith("newsroom:"))
    ?.split(":");
  const uid = Number(account?.[2]);
  const gid = Number(account?.[3]);
  if (!Number.isInteger(uid) || !Number.isInteger(gid)) {
    throw new Error("The newsroom runtime account is unavailable");
  }
  const assignOwnership = (target) => {
    if (path.resolve(target) === path.resolve(optionsPath)) return;
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      lchownSync(target, uid, gid);
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(target)) assignOwnership(path.join(target, entry));
    }
    chownSync(target, uid, gid);
  };
  assignOwnership(dataDir);
  command = "gosu";
  args = ["newsroom", "node", "server.js"];
}

const child = spawn(command, args, { env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
