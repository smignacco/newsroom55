"use client";

import { useCallback, useEffect, useState } from "react";
import type { PulseSnapshot } from "@/lib/health/service";

type PulseResponse =
  | PulseSnapshot
  | { generatedAt: string; privacyMode: true }
  | { error: string };

function duration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours} h ${String(remainder).padStart(2, "0")}`
    : `${remainder} min`;
}

function number(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("fr-CA");
}

function progress(value: number | null, goal: number | null) {
  if (value == null || goal == null || goal <= 0) return null;
  return Math.min(100, Math.round((value / goal) * 100));
}

export function ActivitySleepPulse() {
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [details, setDetails] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/pulse", { cache: "no-store" });
      if (response.status === 401) {
        setUnauthorized(true);
        setSnapshot(null);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as PulseResponse;
      if ("privacyMode" in data && data.privacyMode) {
        setPrivacy(true);
        setSnapshot(null);
      } else if (!("error" in data)) {
        setPrivacy(false);
        setUnauthorized(false);
        setSnapshot(data);
      }
    } catch {
      // The last reliable snapshot remains visible with its freshness indicator.
    }
  }, []);

  useEffect(() => {
    // The initial private API hydration is this effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (privacy) {
    return (
      <section
        className="nr-pulse nr-pulse-private"
        aria-label="Télémétrie personnelle masquée"
      >
        <div className="nr-pulse-head">
          <strong>ACTIVITÉ & SOMMEIL</strong>
          <span>CONFIDENTIEL</span>
        </div>
        <p>Indicateurs personnels masqués.</p>
      </section>
    );
  }

  if (unauthorized) {
    return (
      <section
        className="nr-pulse nr-pulse-locked"
        aria-label="Écran non autorisé"
      >
        <div className="nr-pulse-head">
          <strong>ACTIVITÉ & SOMMEIL</strong>
          <span>VERROUILLÉ</span>
        </div>
        <p>Autorisez cet écran depuis l’administration.</p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="nr-pulse" aria-label="Télémétrie en attente">
        <div className="nr-pulse-head">
          <strong>ACTIVITÉ & SOMMEIL</strong>
          <span>EN ATTENTE</span>
        </div>
      </section>
    );
  }

  const activity = snapshot.activity;
  const sleep = snapshot.sleep;
  const exerciseProgress = progress(
    activity.exerciseMinutes,
    activity.dailyExerciseGoal,
  );
  const stepsProgress = progress(activity.steps, activity.dailyStepsGoal);
  const weeklyProgress = progress(
    activity.weeklyExerciseMinutes,
    activity.weeklyGoalMinutes,
  );
  const latestSleep = sleep.lastNight;
  const phases = latestSleep
    ? [
        {
          key: "deep",
          label: "Profond",
          value: latestSleep.deepMinutes,
          tone: "deep",
        },
        {
          key: "rem",
          label: "REM",
          value: latestSleep.remMinutes,
          tone: "rem",
        },
        {
          key: "core",
          label: "Core",
          value: latestSleep.coreMinutes,
          tone: "core",
        },
        {
          key: "awake",
          label: "Éveillé",
          value: latestSleep.awakeMinutes,
          tone: "awake",
        },
      ].filter((phase) => phase.value != null)
    : [];
  const phaseTotal = phases.reduce((sum, phase) => sum + (phase.value || 0), 0);

  return (
    <>
      <button
        type="button"
        className="nr-pulse"
        onClick={() => setDetails(true)}
        aria-label="Ouvrir les détails d’activité et de sommeil"
      >
        <div className="nr-pulse-head">
          <strong>ACTIVITÉ & SOMMEIL</strong>
          <span className={snapshot.stale ? "is-stale" : ""}>
            {snapshot.lastSyncAt
              ? `SYNC ${new Date(snapshot.lastSyncAt).toLocaleTimeString(
                  "fr-CA",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}`
              : "AUCUNE SYNC"}
          </span>
        </div>

        <div className="nr-pulse-grid">
          <div className="nr-pulse-activity">
            <div className="nr-pulse-kicker">AUJOURD’HUI</div>
            <div className="nr-pulse-metrics">
              <span>
                <b>{number(activity.steps)}</b>
                <small>
                  PAS{stepsProgress != null ? ` · ${stepsProgress}%` : ""}
                </small>
              </span>
              <span>
                <b>{number(activity.exerciseMinutes)}</b>
                <small>
                  MIN EXERCICE
                  {exerciseProgress != null ? ` · ${exerciseProgress}%` : ""}
                </small>
              </span>
              {activity.activeEnergyKcal != null ? (
                <span>
                  <b>{number(activity.activeEnergyKcal)}</b>
                  <small>KCAL ACTIVES</small>
                </span>
              ) : null}
            </div>
            <div className="nr-week-bars" aria-label="Activité des sept jours">
              {activity.days.map((day) => {
                const max = Math.max(
                  activity.weeklyGoalMinutes
                    ? activity.weeklyGoalMinutes / 7
                    : 30,
                  ...activity.days.flatMap((entry) =>
                    entry.minutes == null ? [] : [entry.minutes],
                  ),
                );
                const height =
                  day.minutes == null
                    ? 0
                    : Math.max(8, Math.min(100, (day.minutes / max) * 100));
                return (
                  <span key={day.date} className={`nr-week-day ${day.status}`}>
                    <i style={{ height: `${height}%` }} />
                    <small>{day.label}</small>
                  </span>
                );
              })}
            </div>
            <div className="nr-pulse-foot">
              <span>
                SEMAINE {number(activity.weeklyExerciseMinutes)} MIN
                {weeklyProgress != null ? ` · ${weeklyProgress}%` : ""}
              </span>
              <span>{activity.activeDays} J ACTIFS</span>
            </div>
          </div>

          <div className="nr-pulse-sleep">
            <div className="nr-pulse-kicker">DERNIÈRE NUIT</div>
            <strong className="nr-sleep-duration">
              {duration(latestSleep?.totalMinutes)}
            </strong>
            <span>{latestSleep?.nightDate || "DONNÉES ABSENTES"}</span>
            {sleep.showAverage ? (
              <div className="nr-sleep-average">
                <b>{duration(sleep.averageMinutes)}</b>
                <small>
                  MOYENNE · {sleep.nightsUsed} NUIT
                  {sleep.nightsUsed > 1 ? "S" : ""}
                  {sleep.incompleteHistory ? " · INCOMPLET" : ""}
                </small>
              </div>
            ) : null}
            {sleep.targetMinutes != null ? (
              <div className="nr-sleep-target">
                CIBLE {duration(sleep.targetMinutes)}
                {latestSleep
                  ? ` · ${Math.round(latestSleep.totalMinutes - sleep.targetMinutes)} MIN`
                  : ""}
              </div>
            ) : null}
          </div>
        </div>
      </button>

      {details ? (
        <div className="nr-drawer" onClick={() => setDetails(false)}>
          <div
            className="nr-drawer-panel nr-pulse-detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nr-kicker">
              ACTIVITÉ & SOMMEIL · DONNÉES APPLE SANTÉ
            </div>
            <h3>Détails de récupération</h3>
            <p>
              Dernière nuit :{" "}
              <strong>{duration(latestSleep?.totalMinutes)}</strong>
              {latestSleep
                ? ` · ${latestSleep.nightDate}`
                : " · aucune donnée fiable"}
            </p>
            {sleep.showPhases && phases.length > 0 ? (
              <>
                <div
                  className="nr-sleep-segments"
                  aria-label="Phases de sommeil enregistrées"
                >
                  {phases.map((phase) => (
                    <i
                      key={phase.key}
                      className={phase.tone}
                      style={{
                        flexGrow: phaseTotal > 0 ? phase.value || 0 : 1,
                      }}
                      title={`${phase.label} ${duration(phase.value)}`}
                    />
                  ))}
                </div>
                <div className="nr-phase-legend">
                  {phases.map((phase) => (
                    <span key={phase.key} className={phase.tone}>
                      {phase.label} <b>{duration(phase.value)}</b>
                    </span>
                  ))}
                  {latestSleep?.inBedMinutes != null ? (
                    <span>
                      Au lit <b>{duration(latestSleep.inBedMinutes)}</b>
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p>
                Phases indisponibles ou désactivées. Aucune valeur n’est
                remplacée par zéro.
              </p>
            )}
            <div
              className="nr-sleep-trend"
              aria-label="Tendance sur sept nuits"
            >
              {sleep.trend.map((night) => (
                <span key={night.nightDate}>
                  <i
                    style={{
                      height: `${Math.max(8, Math.min(100, (night.totalMinutes / 600) * 100))}%`,
                    }}
                  />
                  <small>{night.nightDate.slice(5)}</small>
                </span>
              ))}
            </div>
            <p className="nr-pulse-disclaimer">
              Données indicatives synchronisées depuis Apple Santé. Aucune
              interprétation médicale ni score arbitraire n’est produit.
            </p>
            <button
              type="button"
              className="nr-chip"
              onClick={() => setDetails(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
