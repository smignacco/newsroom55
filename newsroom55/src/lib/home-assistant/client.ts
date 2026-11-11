import { validateHttpUrl } from "@/lib/security/urls";

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const MAX_RESPONSE_BYTES = 4_000_000;
const DEFAULT_TIMEOUT_MS = 8_000;

export type HomeAssistantState = {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated: string;
  attributes: {
    friendly_name?: string;
    unit_of_measurement?: string;
    device_class?: string;
    icon?: string;
    [key: string]: unknown;
  };
};

export interface HomeAssistantReader {
  testConnection(): Promise<{ version: string | null }>;
  getStates(): Promise<HomeAssistantState[]>;
  getHistory(
    entityIds: string[],
    startIso: string,
  ): Promise<HomeAssistantState[][]>;
}

function connectionConfig() {
  const baseUrl = process.env.HA_BASE_URL?.trim() || "";
  const token = process.env.HA_TOKEN?.trim() || "";
  if (!baseUrl || !token) {
    throw new Error(
      "Home Assistant n’est pas configuré (HA_BASE_URL et HA_TOKEN requis).",
    );
  }
  const checked = validateHttpUrl(baseUrl);
  if (!checked.ok) throw new Error(`HA_BASE_URL invalide : ${checked.error}`);
  checked.url.pathname = checked.url.pathname.replace(/\/+$/, "");
  checked.url.search = "";
  checked.url.hash = "";
  return { baseUrl: checked.url.toString().replace(/\/$/, ""), token };
}

function validateEntityIds(entityIds: string[]) {
  const unique = [...new Set(entityIds)];
  if (
    unique.length === 0 ||
    unique.length > 20 ||
    unique.some((id) => !ENTITY_ID.test(id))
  ) {
    throw new Error("Identifiant d’entité Home Assistant invalide.");
  }
  return unique;
}

export class HomeAssistantClient implements HomeAssistantReader {
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
  }) {
    const env = options?.baseUrl && options?.token ? null : connectionConfig();
    const rawBaseUrl = options?.baseUrl || env?.baseUrl || "";
    const checked = validateHttpUrl(rawBaseUrl);
    if (!checked.ok) throw new Error(`HA_BASE_URL invalide : ${checked.error}`);
    this.baseUrl = checked.url.toString().replace(/\/+$/, "");
    this.token = options?.token || env?.token || "";
    if (!this.token) throw new Error("HA_TOKEN est requis.");
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Home Assistant a répondu ${response.status}.`);
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_RESPONSE_BYTES
      ) {
        throw new Error("Réponse Home Assistant trop volumineuse.");
      }
      const body = await response.text();
      if (body.length > MAX_RESPONSE_BYTES) {
        throw new Error("Réponse Home Assistant trop volumineuse.");
      }
      return JSON.parse(body) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Délai de connexion à Home Assistant dépassé.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection() {
    const result = await this.request<{ message?: string; version?: string }>(
      "/api/",
    );
    return {
      version: typeof result.version === "string" ? result.version : null,
    };
  }

  async getStates() {
    const states = await this.request<HomeAssistantState[]>("/api/states");
    if (!Array.isArray(states))
      throw new Error("Réponse de capteurs Home Assistant invalide.");
    return states.filter((state) => ENTITY_ID.test(state.entity_id));
  }

  async getHistory(entityIds: string[], startIso: string) {
    const entities = validateEntityIds(entityIds);
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime()))
      throw new Error("Début d’historique invalide.");
    const params = new URLSearchParams({
      filter_entity_id: entities.join(","),
      minimal_response: "1",
      no_attributes: "0",
      significant_changes_only: "1",
    });
    const history = await this.request<HomeAssistantState[][]>(
      `/api/history/period/${encodeURIComponent(start.toISOString())}?${params}`,
    );
    if (!Array.isArray(history))
      throw new Error("Historique Home Assistant invalide.");
    return history.map((series) => (Array.isArray(series) ? series : []));
  }
}

export function homeAssistantConfigured() {
  return Boolean(
    process.env.HA_BASE_URL?.trim() && process.env.HA_TOKEN?.trim(),
  );
}
