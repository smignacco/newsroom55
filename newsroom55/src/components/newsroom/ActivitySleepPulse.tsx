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

function number(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("fr-CA");
}

function ratio(value: number | null | undefined, goal: number | null | undefined) {
  if (value == null || goal == null || goal <= 0) return null;
  return Math.min(1, value / goal);
}

function Arc({
  radius,
  progress,
  color,
  missing,
}: {
  radius: number;
  progress: number | null;
  color: string;
  missing: boolean;
}) {
  const circumference = 2 * Math.PI * radius;
  const offset =
    progress == null ? circumference : circumference * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <circle
      cx="60"
      cy="60"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={missing ? 3.2 : 5.2}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      strokeOpacity={missing ? 0.35 : 0.95}
      pathLength={circumference}
      style={missing ? { strokeDasharray: "3 5" } : undefined}
      transform="rotate(-90 60 60)"
    />
  );
}

function RecoveryDial({
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
  const stepRatio = ratio(steps, stepsGoal);
  const exerciseRatio = ratio(exercise, exerciseGoal);
  const energyRatio = energy == null ? null : Math.min(1, energy / Math.max(energy, 400));
  return (
    <svg className="nr-pulse-dial" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(244,248,252,0.08)" strokeWidth="5.2" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="rgba(244,248,252,0.07)" strokeWidth="5.2" />
      <circle cx="60" cy="60" r="28" fill="none" stroke="rgba(244,248,252,0.06)" strokeWidth="5.2" />
      {Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
        const inner = 56.5;
        const outer = index % 6 === 0 ? 59.5 : 58;
        return (
          <line
            key={index}
            x1={60 + Math.cos(angle) * inner}
            y1={60 + Math.sin(angle) * inner}
            x2={60 + Math.cos(angle) * outer}
            y2={60 + Math.sin(angle) * outer}
            stroke="#91A8BD"
            strokeOpacity="0.45"
            strokeWidth={index % 6 === 0 ? 1.2 : 0.7}
          />
        );
      })}
      <Arc radius={52} progress={stepRatio} color="#35C6F4" missing={stepRatio == null} />
      <Arc radius={40} progress={exerciseRatio} color="#32C997" missing={exerciseRatio == null} />
      <Arc radius={28} progress={energyRatio} color="#F2B85B" missing={energyRatio == null} />
      <text x="60" y="56" textAnchor="middle" fill="#F4F8FC" fontSize="11" fontWeight="700">
        {number(steps)}
      </text>
      <text x="60" y="68" textAnchor="middle" fill="#91A8BD" fontSize="5.4" letterSpacing="0.8">
        PAS
      </text>
    </svg>
  );
}

function NightArc({ phases, total }: { phases: PulsePhase[]; total: number }) {
  const usable = phases.filter((phase) => phase.value != null && phase.value > 0);
  const sum = usable.reduce((acc, phase) => acc + (phase.value || 0), 0) || total;
  let cursor = 0;
  const colors: Record<string, string> = {
    deep: "#8a79ea",
    rem: "#646fe0",
    core: "#438fc0",
    awake: "#8fc8db",
  };
  return (
    <svg className="nr-pulse-night-arc" viewBox="0 0 160 78" aria-hidden>
      <path
        d="M18 70 A 62 62 0 0 1 142 70"
        fill="none"
        stroke="rgba(244,248,252,0.1)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {usable.length === 0 ? (
        <path
          d="M18 70 A 62 62 0 0 1 142 70"
          fill="none"
          stroke="#91A8BD"
          strokeWidth="4"
          strokeDasharray="4 6"
          strokeOpacity="0.45"
        />
      ) : (
        usable.map((phase) => {
          const share = (phase.value || 0) / sum;
          const start = cursor;
          cursor += share;
          return (
            <path
              key={phase.key}
              d="M18 70 A 62 62 0 0 1 142 70"
              fill="none"
              stroke={colors[phase.tone] || "#8a79ea"}
              strokeWidth="10"
              pathLength={100}
              strokeDasharray={`${share * 100} 100`}
              strokeDashoffset={-start * 100}
              strokeLinecap="butt"
            />
          );
        })
      )}
    </svg>
  );
}

function WeekOrbit({
  days,
}: {
  days: PulseSnapshot["activity"]["days"];
}) {
  const max = Math.max(
    30,
    ...days.flatMap((day) => (day.minutes == null ? [] : [day.minutes])),
  );
  return (
    <div className="nr-week-orbit" aria-label="Repos et activité des sept jours">
      {days.map((day) => {
        const progress = day.minutes == null ? null : Math.min(1, day.minutes / max);
        const radius = 11;
        const circumference = 2 * Math.PI * radius;
        return (
          <span key={day.date} className={`nr-week-orbit-day ${day.status}`}>
            <svg viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r={radius} fill="none" stroke="rgba(244,248,252,0.1)" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r={radius}
                fill="none"
                stroke={day.status === "recorded" ? "#35C6F4" : "#91A8BD"}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={
                  progress == null ? circumference : circumference * (1 - progress)
                }
                strokeOpacity={day.status === "recorded" ? 0.95 : 0.35}
                transform="rotate(-90 16 16)"
              />
            </svg>
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
  const phases: PulsePhase[] = latestSleep
    ? [
        { key: "deep", label: "Profond", value: latestSleep.deepMinutes, tone: "deep" },
        { key: "rem", label: "REM", value: latestSleep.remMinutes, tone: "rem" },
        { key: "core", label: "Core", value: latestSleep.coreMinutes, tone: "core" },
        { key: "awake", label: "Éveillé", value: latestSleep.awakeMinutes, tone: "awake" },
      ].filter((phase) => phase.value != null)
    : [];
  const restRatio = ratio(latestSleep?.totalMinutes ?? null, sleep.targetMinutes);
  return (
    <div className="nr-pulse-visual" data-testid="pulse-visual">
      <div className="nr-pulse-broadcast">
        <div className="nr-pulse-effort">
          <div className="nr-pulse-kicker">EFFORT</div>
          <RecoveryDial
            steps={activity.steps}
            stepsGoal={activity.dailyStepsGoal}
            exercise={activity.exerciseMinutes}
            exerciseGoal={activity.dailyExerciseGoal}
            energy={activity.activeEnergyKcal}
          />
          <div className="nr-pulse-legend">
            <span className="is-steps">Pas</span>
            <span className="is-move">Exercice</span>
            <span className="is-heat">Kcal</span>
          </div>
        </div>
        <div className="nr-pulse-rest">
          <div className="nr-pulse-kicker">REPOS</div>
          <strong className="nr-sleep-duration">{duration(latestSleep?.totalMinutes)}</strong>
          <span>{latestSleep?.nightDate || "DONNÉES ABSENTES"}</span>
          <NightArc phases={phases} total={latestSleep?.totalMinutes ?? 0} />
          {sleep.targetMinutes != null ? (
            <div className="nr-sleep-target">
              CIBLE {duration(sleep.targetMinutes)}
              {restRatio != null ? ` · ${Math.round(restRatio * 100)} %` : ""}
            </div>
          ) : null}
        </div>
      </div>
      <WeekOrbit days={activity.days} />
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
