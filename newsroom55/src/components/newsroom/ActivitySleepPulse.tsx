"use client";

import { useCallback, useEffect, useState } from "react";
import type { PulseSnapshot } from "@/lib/health/service";

type PulseResponse =
  | PulseSnapshot
  | { generatedAt: string; privacyMode: true }
  | { error: string };

type DisplayPairing = {
  id: string;
  code: string;
  expiresAt: string;
};

type PulsePhase = {
  key: string;
  label: string;
  value: number | null | undefined;
  tone: string;
};

function duration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours} h ${String(remainder).padStart(2, "0")}`
    : `${remainder} min`;
}

function formatNightDate(value: string | null | undefined) {
  if (!value) return "DONNÉES ABSENTES";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function number(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("fr-CA");
}

function percent(value: number | null | undefined, goal: number | null | undefined) {
  if (value == null || goal == null || goal <= 0) return null;
  return Math.round((value / goal) * 100);
}

function EffortMeters({
  steps,
  stepsGoal,
  exercise,
  exerciseGoal,
  energy,
}: {
  steps: number | null;
  stepsGoal: number | null;
  exercise: number | null;
  exerciseGoal: number | null;
  energy: number | null;
}) {
  const meters = [
    { key: "steps", label: "Pas", value: steps, goal: stepsGoal, tone: "is-steps" },
    {
      key: "exercise",
      label: "Exercice",
      value: exercise,
      goal: exerciseGoal,
      tone: "is-move",
    },
    ...(energy != null
      ? [
          {
            key: "energy",
            label: "Kcal",
            value: energy,
            goal: null as number | null,
            tone: "is-heat",
          },
        ]
      : []),
  ];
  return (
    <div className="nr-effort-meters" aria-label="Indicateurs d’effort">
      {meters.map((meter) => {
        const fill = percent(meter.value, meter.goal);
        const missing = meter.value == null;
        return (
          <div key={meter.key} className={`nr-effort-meter ${meter.tone}`}>
            <span>{meter.label}</span>
            <b>{number(meter.value)}</b>
            {missing || fill != null ? (
              <div className={`nr-effort-track${missing ? " is-missing" : ""}`}>
                <i
                  data-fill={fill == null ? "none" : String(Math.min(100, fill))}
                  style={
                    fill == null
                      ? undefined
                      : { width: `${Math.min(100, Math.max(0, fill))}%` }
                  }
                />
              </div>
            ) : (
              <div className="nr-effort-track is-plain" aria-hidden />
            )}
            <small>{fill != null ? `${fill} %` : "\u00a0"}</small>
          </div>
        );
      })}
    </div>
  );
}

function SleepTarget({
  totalMinutes,
  targetMinutes,
}: {
  totalMinutes: number | null | undefined;
  targetMinutes: number | null | undefined;
}) {
  const fill = percent(totalMinutes, targetMinutes);
  if (fill == null || targetMinutes == null) return null;
  return (
    <div className="nr-sleep-target">
      <div className="nr-effort-track">
        <i
          data-fill={String(Math.min(100, fill))}
          style={{ width: `${Math.min(100, Math.max(0, fill))}%` }}
        />
      </div>
      <small>
        {fill} % · cible {duration(targetMinutes)}
      </small>
    </div>
  );
}

function WeekBars({
  days,
  weeklyGoalMinutes,
}: {
  days: PulseSnapshot["activity"]["days"];
  weeklyGoalMinutes: number | null;
}) {
  const recorded = days.flatMap((day) => (day.minutes == null ? [] : [day.minutes]));
  const max = Math.max(
    weeklyGoalMinutes && weeklyGoalMinutes > 0 ? weeklyGoalMinutes / 7 : 30,
    ...recorded,
  );
  return (
    <div className="nr-week-bars" aria-label="Activité des sept jours">
      {days.map((day) => {
        const missing = day.minutes == null;
        const height = missing
          ? 0
          : Math.max(8, Math.min(100, ((day.minutes || 0) / max) * 100));
        return (
          <span key={day.date} className={`nr-week-day ${day.status}`}>
            <i style={missing ? undefined : { height: `${height}%` }} />
            <small>{day.label}</small>
          </span>
        );
      })}
    </div>
  );
}

export function PulseTelemetry({
  snapshot,
  compact = false,
}: {
  snapshot: PulseSnapshot;
  compact?: boolean;
}) {
  const activity = snapshot.activity;
  const sleep = snapshot.sleep;
  const latestSleep = sleep.lastNight;
  const phases: PulsePhase[] =
    latestSleep && sleep.showPhases
      ? [
          { key: "deep", label: "Profond", value: latestSleep.deepMinutes, tone: "deep" },
          { key: "rem", label: "REM", value: latestSleep.remMinutes, tone: "rem" },
          { key: "core", label: "Core", value: latestSleep.coreMinutes, tone: "core" },
          { key: "awake", label: "Éveillé", value: latestSleep.awakeMinutes, tone: "awake" },
        ].filter((phase) => phase.value != null)
      : [];
  return (
    <div
      className={`nr-pulse-visual${compact ? " is-compact" : ""}`}
      data-testid="pulse-visual"
    >
      <div className="nr-pulse-broadcast">
        <div className="nr-pulse-effort">
          <div className="nr-pulse-kicker">EFFORT</div>
          <EffortMeters
            steps={activity.steps}
            stepsGoal={activity.dailyStepsGoal}
            exercise={activity.exerciseMinutes}
            exerciseGoal={activity.dailyExerciseGoal}
            energy={activity.activeEnergyKcal}
          />
        </div>
        <div className="nr-pulse-rest">
          <div className="nr-pulse-kicker">REPOS</div>
          <strong className="nr-sleep-duration">{duration(latestSleep?.totalMinutes)}</strong>
          <span className="nr-sleep-when">{formatNightDate(latestSleep?.nightDate)}</span>
          <SleepTarget
            totalMinutes={latestSleep?.totalMinutes}
            targetMinutes={sleep.targetMinutes}
          />
        </div>
      </div>
      <WeekBars
        days={activity.days}
        weeklyGoalMinutes={activity.weeklyGoalMinutes}
      />
      {!compact && sleep.showPhases && phases.length > 0 ? (
        <div className="nr-sleep-phases" aria-label="Phases de sommeil">
          {phases.map((phase) => (
            <span key={phase.key} className={phase.tone}>
              {phase.label} <b>{duration(phase.value)}</b>
            </span>
          ))}
        </div>
      ) : null}
      <div className="nr-pulse-foot">
        <span>
          SEMAINE {number(activity.weeklyExerciseMinutes)} MIN
        </span>
        <span>{activity.activeDays} J ACTIFS</span>
      </div>
      {sleep.showAverage && !compact ? (
        <div className="nr-sleep-average">
          <b>{duration(sleep.averageMinutes)}</b>
          <small>
            MOYENNE · {sleep.nightsUsed} NUIT
            {sleep.nightsUsed > 1 ? "S" : ""}
            {sleep.incompleteHistory ? " · INCOMPLET" : ""}
          </small>
        </div>
      ) : null}
    </div>
  );
}

export function ActivitySleepPulse() {
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [pairing, setPairing] = useState<DisplayPairing | null>(null);
  const [pairingError, setPairingError] = useState("");
  const [details, setDetails] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/pulse", { cache: "no-store" });
      if (response.status === 401) {
        setUnauthorized(true);
        setPrivacy(false);
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

  useEffect(() => {
    if (!unauthorized || pairing) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    const createPairing = async () => {
      try {
        const response = await fetch("/api/pulse/display-pairing", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "create" }),
        });
        if (!response.ok) throw new Error("pairing unavailable");
        const data = (await response.json()) as {
          id: string;
          code: string;
          expiresAt: string;
        };
        if (!cancelled) {
          setPairing(data);
          setPairingError("");
        }
      } catch {
        if (!cancelled) {
          setPairingError("Code d’association temporairement indisponible.");
          retryTimer = window.setTimeout(() => void createPairing(), 30_000);
        }
      }
    };
    void createPairing();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [pairing, unauthorized]);

  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    const checkPairing = async () => {
      try {
        const response = await fetch("/api/pulse/display-pairing", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "status",
            pairingId: pairing.id,
          }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          status: "pending" | "approved" | "expired" | "missing";
        };
        if (cancelled) return;
        if (data.status === "approved") {
          setUnauthorized(false);
          setPairing(null);
          await refresh();
        } else if (data.status === "expired" || data.status === "missing") {
          setPairing(null);
        }
      } catch {
        // Keep the current code visible and retry while it remains valid.
      }
    };
    void checkPairing();
    const timer = window.setInterval(() => void checkPairing(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pairing, refresh]);

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
        {pairing ? (
          <>
            <p>
              Dans <strong>Administration → Activity &amp; Sleep</strong>,
              entrez ce code puis choisissez « Autoriser le Board ».
            </p>
            <strong className="nr-pulse-pairing-code">
              {pairing.code.slice(0, 3)} {pairing.code.slice(3)}
            </strong>
          </>
        ) : (
          <p>{pairingError || "Création du code d’association…"}</p>
        )}
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

  const latestSleep = snapshot.sleep.lastNight;
  const phases: PulsePhase[] = latestSleep
    ? [
        { key: "deep", label: "Profond", value: latestSleep.deepMinutes, tone: "deep" },
        { key: "rem", label: "REM", value: latestSleep.remMinutes, tone: "rem" },
        { key: "core", label: "Core", value: latestSleep.coreMinutes, tone: "core" },
        { key: "awake", label: "Éveillé", value: latestSleep.awakeMinutes, tone: "awake" },
      ].filter((phase) => phase.value != null)
    : [];

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
        <PulseTelemetry snapshot={snapshot} compact />
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
            <PulseTelemetry snapshot={snapshot} />
            <p>
              Dernière nuit :{" "}
              <strong>{duration(latestSleep?.totalMinutes)}</strong>
              {latestSleep
                ? ` · ${latestSleep.nightDate}`
                : " · aucune donnée fiable"}
            </p>
            {snapshot.sleep.showPhases && phases.length > 0 ? (
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
            ) : (
              <p>
                Phases indisponibles ou désactivées. Aucune valeur n’est
                remplacée par zéro.
              </p>
            )}
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
