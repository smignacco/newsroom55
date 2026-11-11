"use client";

import { useEffect, useMemo, useState } from "react";

type Metric =
  | "steps"
  | "exercise_minutes"
  | "active_energy"
  | "move_goal"
  | "exercise_goal"
  | "stand_hours"
  | "sleep_duration"
  | "in_bed"
  | "awake"
  | "core_sleep"
  | "deep_sleep"
  | "rem_sleep";

type HealthSettings = {
  enabled: boolean;
  privacyMode: boolean;
  dailyExerciseGoal: number | null;
  dailyStepsGoal: number | null;
  weeklyActivityGoal: number | null;
  sleepTargetMinutes: number | null;
  showAverage: boolean;
  showPhases: boolean;
  showActiveEnergy: boolean;
};

type Mapping = {
  metric: Metric;
  entityId: string;
  unit: string | null;
};

type DiscoveredEntity = {
  entityId: string;
  name: string;
  unit: string | null;
  metric: Metric;
  confidence: "exact" | "probable";
};

type AdminSnapshot = {
  configured: boolean;
  settings: HealthSettings;
  mappings: Mapping[];
  sync: {
    last_attempt_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  } | null;
  history: {
    activity: {
      steps: number | null;
      exerciseMinutes: number | null;
      days: Array<{
        date: string;
        label: string;
        minutes: number | null;
        status: "recorded" | "missing" | "future";
      }>;
    };
    sleep: {
      trend: Array<{ nightDate: string; totalMinutes: number }>;
    };
  };
};

const metricGroups: Array<{
  title: string;
  metrics: Array<{ metric: Metric; label: string; optional?: boolean }>;
}> = [
  {
    title: "Activité",
    metrics: [
      { metric: "steps", label: "Pas" },
      { metric: "exercise_minutes", label: "Minutes d’exercice" },
      { metric: "active_energy", label: "Énergie active", optional: true },
      {
        metric: "move_goal",
        label: "Objectif Bouger Apple Watch",
        optional: true,
      },
      {
        metric: "exercise_goal",
        label: "Objectif Exercice Apple Watch",
        optional: true,
      },
      { metric: "stand_hours", label: "Heures debout", optional: true },
    ],
  },
  {
    title: "Sommeil",
    metrics: [
      { metric: "sleep_duration", label: "Durée totale du sommeil" },
      { metric: "in_bed", label: "Temps au lit", optional: true },
      { metric: "awake", label: "Temps éveillé", optional: true },
      { metric: "core_sleep", label: "Sommeil Core / léger", optional: true },
      { metric: "deep_sleep", label: "Sommeil profond", optional: true },
      { metric: "rem_sleep", label: "Sommeil REM", optional: true },
    ],
  },
];

const defaultSettings: HealthSettings = {
  enabled: false,
  privacyMode: true,
  dailyExerciseGoal: null,
  dailyStepsGoal: null,
  weeklyActivityGoal: null,
  sleepTargetMinutes: null,
  showAverage: true,
  showPhases: false,
  showActiveEnergy: false,
};

async function healthApi(path: string, csrf: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `La requête a échoué (${response.status})`);
  }
  return data;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function duration(minutes: number | null) {
  if (minutes === null) return "—";
  return `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function HealthManager({ csrf }: { csrf: string }) {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [settings, setSettings] = useState<HealthSettings>(defaultSettings);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredEntity[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const mappingsByMetric = useMemo(
    () => new Map(mappings.map((mapping) => [mapping.metric, mapping])),
    [mappings],
  );

  async function load() {
    const data = (await healthApi("/api/admin/health", csrf)) as AdminSnapshot;
    setSnapshot(data);
    setSettings(data.settings);
    setMappings(data.mappings);
  }

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught) =>
      setError(
        caught instanceof Error ? caught.message : "Chargement impossible",
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(
    key: string,
    action: () => Promise<string>,
    reload = true,
  ) {
    setPending(key);
    setMessage("");
    setError("");
    try {
      setMessage(await action());
      if (reload) await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "La commande a échoué",
      );
    } finally {
      setPending(null);
    }
  }

  function setMapping(metric: Metric, entityId: string) {
    const existing = mappingsByMetric.get(metric);
    setMappings((current) => [
      ...current.filter((mapping) => mapping.metric !== metric),
      {
        metric,
        entityId,
        unit: existing?.unit ?? null,
      },
    ]);
  }

  function mapSuggestedEntities(entities: DiscoveredEntity[]) {
    setMappings((current) => {
      const next = new Map(current.map((mapping) => [mapping.metric, mapping]));
      for (const entity of entities) {
        if (next.get(entity.metric)?.entityId) continue;
        next.set(entity.metric, {
          metric: entity.metric,
          entityId: entity.entityId,
          unit: entity.unit,
        });
      }
      return [...next.values()];
    });
  }

  return (
    <div className="health-manager">
      <header className="health-manager-hero">
        <div>
          <div className="nr-kicker">Télémétrie personnelle · Apple Santé</div>
          <h2>Activity &amp; Sleep Pulse</h2>
          <p>
            Une synthèse secondaire et confidentielle. NEWSROOM ne collecte ni
            fréquence cardiaque, ni localisation, et ne produit aucune
            interprétation médicale.
          </p>
        </div>
        <div
          className={`health-connection ${snapshot?.configured ? "is-ready" : ""}`}
        >
          <span>HOME ASSISTANT</span>
          <strong>{snapshot?.configured ? "Configuré" : "À configurer"}</strong>
          <small>
            Dernière synchronisation réussie :{" "}
            {snapshot?.sync?.last_success_at
              ? new Date(snapshot.sync.last_success_at).toLocaleString("fr-CA")
              : "aucune"}
          </small>
        </div>
      </header>

      {message ? <div className="tv-notice tv-notice-ok">{message}</div> : null}
      {error ? <div className="tv-notice tv-notice-error">{error}</div> : null}
      {snapshot?.sync?.last_error ? (
        <div className="tv-notice tv-notice-error">
          Dernière erreur : {snapshot.sync.last_error}
        </div>
      ) : null}

      <section className="health-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">01</span>
            <div>
              <h3>Affichage et confidentialité</h3>
              <p>
                Le module et sa lecture personnelle sont désactivés par défaut.
              </p>
            </div>
          </div>
        </div>
        <div className="health-toggle-grid">
          {[
            [
              "enabled",
              "Afficher le panneau personnel",
              "L’écran doit ensuite être autorisé.",
            ],
            [
              "privacyMode",
              "Mode confidentiel",
              "Masque immédiatement toutes les mesures.",
            ],
            [
              "showAverage",
              "Moyenne de sommeil",
              "Calculée uniquement avec les nuits fiables disponibles.",
            ],
            [
              "showPhases",
              "Phases de sommeil",
              "Affichage facultatif dans le détail tactile.",
            ],
            [
              "showActiveEnergy",
              "Énergie active",
              "Affiche les kilocalories lorsqu’elles existent.",
            ],
          ].map(([key, label, help]) => (
            <label className="health-toggle" key={key}>
              <input
                type="checkbox"
                checked={settings[key as keyof HealthSettings] === true}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>{label}</strong>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="health-actions">
          <button
            className="nr-chip nr-chip-accent"
            type="button"
            disabled={pending !== null}
            onClick={() =>
              void run(
                "display-on",
                async () => {
                  await healthApi("/api/admin/health/display-access", csrf, {
                    method: "POST",
                    body: JSON.stringify({ enabled: true }),
                  });
                  return "Cet écran est autorisé à lire la synthèse personnelle.";
                },
                false,
              )
            }
          >
            Autoriser cet écran
          </button>
          <button
            className="nr-chip"
            type="button"
            disabled={pending !== null}
            onClick={() =>
              void run(
                "display-off",
                async () => {
                  await healthApi("/api/admin/health/display-access", csrf, {
                    method: "DELETE",
                  });
                  return "L’autorisation de cet écran a été retirée.";
                },
                false,
              )
            }
          >
            Retirer l’autorisation
          </button>
        </div>
      </section>

      <section className="health-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">02</span>
            <div>
              <h3>Connexion Home Assistant</h3>
              <p>
                Le jeton reste dans l’environnement privé du module
                complémentaire.
              </p>
            </div>
          </div>
        </div>
        <div className="health-actions">
          <button
            type="button"
            className="nr-chip"
            disabled={pending !== null || !snapshot?.configured}
            onClick={() =>
              void run(
                "test",
                async () => {
                  const result = await healthApi(
                    "/api/admin/health/test",
                    csrf,
                    { method: "POST" },
                  );
                  return `Connexion réussie à ${result.version || "Home Assistant"}.`;
                },
                false,
              )
            }
          >
            {pending === "test" ? "Test…" : "Tester la connexion"}
          </button>
          <button
            type="button"
            className="nr-chip nr-chip-accent"
            disabled={pending !== null || !snapshot?.configured}
            onClick={() =>
              void run(
                "discover",
                async () => {
                  const data = await healthApi(
                    "/api/admin/health/discover",
                    csrf,
                    {
                      method: "POST",
                    },
                  );
                  const entities = data.entities as DiscoveredEntity[];
                  setDiscovered(entities);
                  mapSuggestedEntities(entities);
                  return `${entities.length} capteur(s) compatible(s) découvert(s). Vérifiez les associations proposées.`;
                },
                false,
              )
            }
          >
            {pending === "discover" ? "Découverte…" : "Découvrir les capteurs"}
          </button>
          <button
            type="button"
            className="nr-chip"
            disabled={pending !== null || !snapshot?.configured}
            onClick={() =>
              void run("sync", async () => {
                await healthApi("/api/admin/health/sync", csrf, {
                  method: "POST",
                });
                return "Synchronisation terminée.";
              })
            }
          >
            {pending === "sync"
              ? "Synchronisation…"
              : "Synchroniser maintenant"}
          </button>
        </div>
        {!snapshot?.configured ? (
          <p className="health-help">
            Renseignez <code>HA_BASE_URL</code> et <code>HA_TOKEN</code> dans
            l’onglet Configuration du module complémentaire, puis redémarrez-le.
            Le jeton n’est jamais transmis au navigateur.
          </p>
        ) : null}
        <p className="health-help">
          Sur l’iPhone : Home Assistant Companion → Réglages → Companion App →
          Capteurs → Apple Santé. Activez les mesures d’activité et de sommeil
          voulues, puis actualisez les entités dans Home Assistant.
        </p>
      </section>

      <section className="health-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">03</span>
            <div>
              <h3>Correspondance des capteurs</h3>
              <p>
                Les identifiants varient selon le nom de l’iPhone et la langue.
              </p>
            </div>
          </div>
        </div>
        <datalist id="health-entities">
          {discovered.map((entity) => (
            <option
              key={`${entity.entityId}-${entity.metric}`}
              value={entity.entityId}
            >
              {entity.name} · {entity.unit || "sans unité"} ·{" "}
              {entity.confidence}
            </option>
          ))}
        </datalist>
        <div className="health-mapping-groups">
          {metricGroups.map((group) => (
            <div key={group.title}>
              <h4>{group.title}</h4>
              {group.metrics.map(({ metric, label, optional }) => (
                <label className="health-mapping" key={metric}>
                  <span>
                    <strong>{label}</strong>
                    {optional ? <small>facultatif</small> : null}
                  </span>
                  <input
                    list="health-entities"
                    autoComplete="off"
                    placeholder="sensor.…"
                    value={mappingsByMetric.get(metric)?.entityId ?? ""}
                    onChange={(event) => setMapping(metric, event.target.value)}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="health-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">04</span>
            <div>
              <h3>Objectifs personnels</h3>
              <p>
                Tous les objectifs sont facultatifs et n’entraînent aucun
                jugement.
              </p>
            </div>
          </div>
        </div>
        <div className="health-goals">
          <label>
            Minutes d’exercice par jour
            <input
              type="number"
              min="1"
              max="1440"
              value={settings.dailyExerciseGoal ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  dailyExerciseGoal: optionalNumber(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Pas par jour
            <input
              type="number"
              min="1"
              max="200000"
              value={settings.dailyStepsGoal ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  dailyStepsGoal: optionalNumber(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Minutes d’activité par semaine
            <input
              type="number"
              min="1"
              max="10080"
              value={settings.weeklyActivityGoal ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  weeklyActivityGoal: optionalNumber(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Sommeil souhaité (minutes)
            <input
              type="number"
              min="1"
              max="1440"
              value={settings.sleepTargetMinutes ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  sleepTargetMinutes: optionalNumber(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <div className="health-actions">
          <button
            type="button"
            className="nr-chip nr-chip-accent"
            disabled={pending !== null}
            onClick={() =>
              void run("save", async () => {
                await healthApi("/api/admin/health", csrf, {
                  method: "POST",
                  body: JSON.stringify({
                    settings,
                    mappings: metricGroups.flatMap((group) =>
                      group.metrics.map(({ metric }) => ({
                        metric,
                        entityId:
                          mappingsByMetric.get(metric)?.entityId.trim() || null,
                      })),
                    ),
                  }),
                });
                return "Configuration Activity & Sleep enregistrée.";
              })
            }
          >
            {pending === "save"
              ? "Enregistrement…"
              : "Enregistrer la configuration"}
          </button>
        </div>
      </section>

      <section className="health-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">05</span>
            <div>
              <h3>Historique local</h3>
              <p>
                Résumé SQLite conservé pour les tendances, sans détails
                médicaux.
              </p>
            </div>
          </div>
        </div>
        <div className="health-history">
          <div>
            <h4>Activité récente</h4>
            {snapshot?.history.activity.days.some(
              (day) => day.status === "recorded",
            ) ? (
              snapshot.history.activity.days.map((day) => (
                <div key={day.date}>
                  <span>{day.date}</span>
                  <strong>
                    {day.status === "future"
                      ? "À venir"
                      : day.minutes === null
                        ? "Donnée absente"
                        : `${Math.round(day.minutes)} min`}
                  </strong>
                </div>
              ))
            ) : (
              <p>Aucune journée synchronisée.</p>
            )}
          </div>
          <div>
            <h4>Sommeil récent</h4>
            {snapshot?.history.sleep.trend.length ? (
              snapshot.history.sleep.trend.map((night) => (
                <div key={night.nightDate}>
                  <span>{night.nightDate}</span>
                  <strong>{duration(night.totalMinutes)}</strong>
                </div>
              ))
            ) : (
              <p>Aucune nuit synchronisée.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
