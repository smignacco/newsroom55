import http from "node:http";
import https from "node:https";

const deviceIp = process.env.ROOMOS_DEVICE_IP || "192.168.10.245";
const username = process.env.ROOMOS_USERNAME;
const password = process.env.ROOMOS_PASSWORD;
const newsroomUrl = process.env.NEWSROOM_URL;
const protocol = process.env.ROOMOS_PROTOCOL === "http" ? "http" : "https";
const apply = process.env.ROOMOS_APPLY === "1";
const insecureTls = process.env.ROOMOS_INSECURE_TLS === "1";

function fail(message) {
  console.error(`[roomos] ${message}`);
  process.exit(1);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

if (!username) fail("ROOMOS_USERNAME is required.");
if (!newsroomUrl) fail("NEWSROOM_URL is required (the LAN/HTTPS URL reachable by the Board).");
let parsedNewsroomUrl;
try {
  parsedNewsroomUrl = new URL(newsroomUrl);
} catch {
  fail("NEWSROOM_URL is invalid.");
}
if (!["http:", "https:"].includes(parsedNewsroomUrl.protocol)) fail("NEWSROOM_URL must use HTTP or HTTPS.");
if (["localhost", "127.0.0.1", "::1"].includes(parsedNewsroomUrl.hostname)) {
  fail("NEWSROOM_URL must use the Docker host LAN name or IP, not localhost.");
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Configuration>
  <WebEngine>
    <Mode>On</Mode>
  </WebEngine>
  <Standby>
    <Signage>
      <Mode>On</Mode>
      <Url>${escapeXml(parsedNewsroomUrl.toString())}</Url>
      <InteractionMode>Interactive</InteractionMode>
      <Audio>On</Audio>
    </Signage>
  </Standby>
</Configuration>`;

console.log(`[roomos] Device: ${protocol}://${deviceIp}`);
console.log(`[roomos] User: ${username}`);
console.log(`[roomos] Signage URL: ${parsedNewsroomUrl.toString()}`);
console.log(`[roomos] TLS verification: ${insecureTls ? "disabled for this local device" : "enabled"}`);

if (!apply) {
  console.log("[roomos] Dry run only. Set ROOMOS_APPLY=1 and ROOMOS_PASSWORD to apply.");
  process.exit(0);
}
if (!password) fail("ROOMOS_PASSWORD is required when ROOMOS_APPLY=1.");

const transport = protocol === "https" ? https : http;
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: deviceIp,
        port: protocol === "https" ? 443 : 80,
        path,
        method,
        timeout: 10_000,
        rejectUnauthorized: !insecureTls,
        headers: {
          authorization,
          accept: "text/xml",
          ...(body
            ? {
                "content-type": "text/xml",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`RoomOS returned HTTP ${response.statusCode || "unknown"}: ${responseBody.slice(0, 300)}`));
            return;
          }
          resolve(responseBody);
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("RoomOS request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

try {
  const applyResponse = await request("/putxml", "POST", xml);
  if (/status="Error"|<Error[\s>]/i.test(applyResponse)) {
    throw new Error(`RoomOS rejected part of the configuration: ${applyResponse.slice(0, 500)}`);
  }
  const verification = await request("/getxml?location=/Configuration/Standby/Signage", "GET");
  if (!verification.includes(parsedNewsroomUrl.toString())) {
    throw new Error("RoomOS accepted the request, but the signage URL was not found during verification.");
  }
  if (!/<InteractionMode[^>]*>\s*Interactive\s*<\/InteractionMode>/i.test(verification)) {
    throw new Error("RoomOS did not report Standby Signage InteractionMode=Interactive.");
  }
  console.log("[roomos] Configuration applied and signage URL verified.");
  console.log("[roomos] WebEngine=On, Signage=On, InteractionMode=Interactive, Audio=On.");
} catch (error) {
  fail(error instanceof Error ? error.message : "Unknown RoomOS error.");
}
