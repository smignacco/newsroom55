"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/news/classify";
import { TIMEZONES } from "@/lib/time";
import { TelevisionManager } from "@/components/admin/TelevisionManager";
import { FinanceManager } from "@/components/admin/FinanceManager";
import { HealthManager } from "@/components/admin/HealthManager";

type Tab = "news" | "finance" | "health" | "tv" | "look" | "alerts";

async function api(path: string, csrf: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function AdminConsole({ username, csrf }: { username: string; csrf: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("news");
  const [sources, setSources] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [s, st] = await Promise.all([
      api("/api/admin/sources", csrf),
      api("/api/admin/settings", csrf),
    ]);
    setSources(s.sources);
    setSettings(st.settings);
    setRules(st.rules);
  }

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage("Configuration saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="nr-admin">
      <div className="nr-admin-top">
        <div>
          <div className="nr-brand-name">CENTRE DE NOUVELLES</div>
          <div className="nr-brand-sig">Administration · {username}</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="nr-chip" href="/" style={{ display: "inline-flex", alignItems: "center" }}>
            Open board
          </Link>
          <button
            type="button"
            className="nr-chip"
            onClick={() => run(async () => { await api("/api/admin/refresh", csrf, { method: "POST" }); })}
          >
            Refresh wires
          </button>
          <button
            type="button"
            className="nr-chip"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/admin/login");
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="nr-admin-grid">
        <nav className="nr-admin-nav">
          {(
            [
              ["news", "News"],
              ["finance", "Finance"],
              ["health", "Activity & Sleep"],
              ["tv", "Television"],
              ["look", "Appearance"],
              ["alerts", "Alerts"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <main className="nr-admin-main">
          {message ? <p className="nr-ok">{message}</p> : null}
          {error ? <p className="nr-error">{error}</p> : null}

          {tab === "news" ? (
            <>
              <h2 className="nr-brand-name" style={{ letterSpacing: "0.18em", fontSize: "0.9rem" }}>
                Sources
              </h2>
              <table className="nr-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={String(s.id)}>
                      <td>
                        {String(s.name)}
                        <div className="nr-time">{String(s.url)}</div>
                      </td>
                      <td>{String(s.default_category)}</td>
                      <td>
                        {String(s.last_status || "pending")}
                        {s.last_error ? <div className="nr-error">{String(s.last_error)}</div> : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="nr-chip"
                          onClick={() =>
                            run(async () => {
                              await api(`/api/admin/sources/${s.id}`, csrf, {
                                method: "PATCH",
                                body: JSON.stringify({ enabled: !s.enabled }),
                              });
                            })
                          }
                        >
                          {s.enabled ? "On" : "Off"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AddSource csrf={csrf} onSave={() => run(async () => undefined)} save={run} />
            </>
          ) : null}

          {tab === "finance" ? <FinanceManager csrf={csrf} /> : null}

          {tab === "health" ? <HealthManager csrf={csrf} /> : null}

          {tab === "tv" ? <TelevisionManager csrf={csrf} /> : null}

          {tab === "look" ? (
            <div style={{ display: "grid", gap: "0.8rem", maxWidth: "28rem" }}>
              <label className="nr-field">
                Layout
                <select
                  value={settings.layout || "broadcast-classic"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ layout: e.target.value }),
                      });
                    })
                  }
                >
                  <option value="broadcast-classic">Broadcast classic</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label className="nr-field">
                Text size
                <select
                  value={settings.text_scale || "100"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ text_scale: e.target.value }),
                      });
                    })
                  }
                >
                  <option value="90">90%</option>
                  <option value="100">100%</option>
                  <option value="110">110%</option>
                  <option value="125">125%</option>
                </select>
              </label>
              <label className="nr-field">
                Fuseau horaire
                <select
                  value={settings.timezone || "America/Montreal"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ timezone: e.target.value }),
                      });
                    })
                  }
                >
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="nr-field">
                Actualisation des nouvelles
                <select
                  value={settings.news_interval_sec || "180"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ news_interval_sec: e.target.value }),
                      });
                    })
                  }
                >
                  <option value="180">Toutes les 3 minutes</option>
                  <option value="300">Toutes les 5 minutes</option>
                  <option value="600">Toutes les 10 minutes</option>
                </select>
              </label>
              <label className="nr-field">
                Ticker speed
                <select
                  value={settings.ticker_speed || "42"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ ticker_speed: e.target.value }),
                      });
                    })
                  }
                >
                  <option value="28">Fast</option>
                  <option value="42">Standard</option>
                  <option value="60">Slow</option>
                </select>
              </label>
              <label className="nr-field">
                Motion
                <select
                  value={settings.animations || "full"}
                  onChange={(e) =>
                    run(async () => {
                      await api("/api/admin/settings", csrf, {
                        method: "POST",
                        body: JSON.stringify({ animations: e.target.value }),
                      });
                    })
                  }
                >
                  <option value="full">Full</option>
                  <option value="reduced">Performance</option>
                </select>
              </label>
            </div>
          ) : null}

          {tab === "alerts" ? (
            <>
              <p>Rules fire only on real headlines. They never invent a breaking story.</p>
              <table className="nr-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Level</th>
                    <th>On</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={String(r.id)}>
                      <td>{String(r.pattern)}</td>
                      <td>{String(r.level)}</td>
                      <td>
                        <button
                          type="button"
                          className="nr-chip"
                          onClick={() =>
                            run(async () => {
                              await api("/api/admin/rules", csrf, {
                                method: "PATCH",
                                body: JSON.stringify({ id: r.id, enabled: !r.enabled }),
                              });
                            })
                          }
                        >
                          {r.enabled ? "On" : "Off"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
function AddSource({
  csrf,
  save,
}: {
  csrf: string;
  onSave: () => void;
  save: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("International");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          await api("/api/admin/sources", csrf, {
            method: "POST",
            body: JSON.stringify({ name, url, default_category: category }),
          });
          setName("");
          setUrl("");
        });
      }}
      style={{ marginTop: "1.2rem", display: "grid", gap: "0.6rem", maxWidth: "32rem" }}
    >
      <div className="nr-kicker">Add source</div>
      <input className="nr-field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="nr-field" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <button type="submit" className="nr-chip">
        Add feed
      </button>
    </form>
  );
}

// Form helpers intentionally stay local to the administration console.
