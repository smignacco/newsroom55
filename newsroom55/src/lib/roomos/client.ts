import http from "node:http";
import https from "node:https";

export type RoomOsAction =
  | "standby"
  | "halfwake"
  | "wake"
  | "volume-up"
  | "volume-down";

function requestRoomOs(
  path: string,
  method: "GET" | "POST",
  body?: string,
  timeoutMs = 10_000,
): Promise<string> {
  const hostname = process.env.ROOMOS_DEVICE_IP?.trim();
  const username = process.env.ROOMOS_USERNAME?.trim();
  const password = process.env.ROOMOS_PASSWORD;
  const protocol = process.env.ROOMOS_PROTOCOL === "http" ? "http" : "https";
  if (!hostname || !username || !password) {
    throw new Error("RoomOS credentials are not configured on the server");
  }
  const transport = protocol === "https" ? https : http;
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        hostname,
        port: protocol === "https" ? 443 : 80,
        path,
        method,
        timeout: timeoutMs,
        rejectUnauthorized: process.env.ROOMOS_INSECURE_TLS !== "1",
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
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`RoomOS returned HTTP ${response.statusCode || "unknown"}`));
            return;
          }
          if (/status="Error"|<Error[\s>]/i.test(responseBody)) {
            reject(new Error(`RoomOS rejected the command: ${responseBody.slice(0, 300)}`));
            return;
          }
          resolve(responseBody);
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("RoomOS request timed out")));
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export function roomOsCommandXml(action: RoomOsAction): string {
  if (action === "volume-up") {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<Command><Audio><Volume><Increase/></Volume></Audio></Command>';
  }
  if (action === "volume-down") {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<Command><Audio><Volume><Decrease/></Volume></Audio></Command>';
  }
  const command =
    action === "standby" ? "Activate" : action === "halfwake" ? "Halfwake" : "Deactivate";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Command><Standby><${command}/></Standby></Command>`;
}

export async function sendRoomOsCommand(action: RoomOsAction): Promise<void> {
  await requestRoomOs("/putxml", "POST", roomOsCommandXml(action));
}

export function parseRoomOsPowerState(
  xml: string,
): "active" | "standby" | "halfwake" | null {
  const value = xml.match(/<State(?:\s[^>]*)?>([^<]+)<\/State>/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (value === "off") return "active";
  if (value === "halfwake") return "halfwake";
  if (value === "standby" || value === "enteringstandby") return "standby";
  return null;
}

export async function getRoomOsPowerState(): Promise<
  "active" | "standby" | "halfwake"
> {
  const xml = await requestRoomOs(
    "/getxml?location=%2FStatus%2FStandby%2FState",
    "GET",
    undefined,
    2_500,
  );
  const state = parseRoomOsPowerState(xml);
  if (!state) throw new Error("RoomOS returned an unknown standby state");
  return state;
}
