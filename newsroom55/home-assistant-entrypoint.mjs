import { spawn } from "node:child_process";
import {
  chownSync,
  existsSync,
  lchownSync,
  lstatSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import {
  OPTIONS_PATH,
  applyHomeAssistantOptions,
  ensureSessionSecret,
  readHomeAssistantOptions,
  requireAdminPassword,
} from "./home-assistant-options.mjs";

const dataDir = process.env.DATA_DIR || "/app/data";

let options;
try {
  options = readHomeAssistantOptions(OPTIONS_PATH);
} catch (error) {
  console.error("[newsroom55]", error instanceof Error ? error.message : error);
  process.exit(1);
}

applyHomeAssistantOptions(options);
if (existsSync(OPTIONS_PATH)) {
  try {
    requireAdminPassword();
  } catch (error) {
    console.error("[newsroom55]", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
ensureSessionSecret(dataDir);

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
    if (path.resolve(target) === path.resolve(OPTIONS_PATH)) return;
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
  if (existsSync(dataDir)) assignOwnership(dataDir);
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
