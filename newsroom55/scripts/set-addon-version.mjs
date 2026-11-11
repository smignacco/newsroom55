import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const version = process.argv[2]?.trim();
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run addon:version -- 1.0.0-ha.2");
  process.exit(1);
}

const configPath = path.resolve("config.yaml");
const config = readFileSync(configPath, "utf8");
const versionField = /^version:\s*"[^"]+"/m;
if (!versionField.test(config)) {
  console.error("Unable to locate the version field in config.yaml");
  process.exit(1);
}
const next = config.replace(versionField, `version: "${version}"`);
writeFileSync(configPath, next);
console.log(`Home Assistant app version set to ${version}`);
