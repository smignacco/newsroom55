"use client";

import { FormEvent, useEffect, useState } from "react";
import type { GivernySettings, ValidationReport } from "@/lib/giverny/types";

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

async function givernyApi(path: string, csrf: string, init?: RequestInit) {
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
  if (!response.ok) throw new Error(data.error || `La requête a échoué (${response.status})`);
  return data;
}

export function GivernyManager({ csrf }: { csrf: string }) {
  const [settings, setSettings] = useState<GivernySettings | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [month, setMonth] = useState("");
  const [officialPct, setOfficialPct] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accessionHint, setAccessionHint] = useState("");
  const [filedAtHint, setFiledAtHint] = useState("");

  async function load() {
    const data = await givernyApi("/api/admin/giverny", csrf);
    setSettings(data.settings);
    setValidation(data.validation);
    setContactEmail(data.settings?.contactEmail || "");
  }

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Chargement impossible"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(key: string, action: () => Promise<string>) {
    setPending(key);
    setMessage("");
    setError("");
    try {
      setMessage(await action());
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La commande a échoué");
    } finally {
      setPending(null);
    }
  }

  if (!settings) {
    return <p className="nr-time">{error || "Chargement du module Giverny…"}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "1.1rem", maxWidth: "48rem" }}>
      {message ? <p className="nr-ok">{message}</p> : null}
      {error ? <p className="nr-error">{error}</p> : null}

      <h2 className="nr-brand-name" style={{ letterSpacing: "0.18em", fontSize: "0.9rem" }}>
        Indice synthétique Giverny
      </h2>
      <p className="nr-time">
        Estimation quotidienne à partir des 13F publics. Ce n’est pas le VL officiel.
        Les mois officiels sont comparés à la série synthétique, jamais substitués.
      </p>

      <label className="nr-field">
        Module
        <select
          value={settings.enabled ? "on" : "off"}
          onChange={(event) =>
            run("enabled", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ enabled: event.target.value === "on" }),
              });
              return "Affichage mis à jour.";
            })
          }
        >
          <option value="on">Activé sur le Board</option>
          <option value="off">Masqué</option>
        </select>
      </label>

      <label className="nr-field">
        Intervalle d’actualisation
        <select
          value={String(settings.refreshMinutes)}
          onChange={(event) =>
            run("refresh", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ refreshMinutes: Number(event.target.value) }),
              });
              return "Intervalle enregistré.";
            })
          }
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">60 minutes</option>
        </select>
      </label>

      <label className="nr-field">
        Devise d’affichage
        <select
          value={settings.currency}
          onChange={(event) =>
            run("currency", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ currency: event.target.value }),
              });
              return "Devise enregistrée.";
            })
          }
        >
          <option value="CAD">CAD (défaut)</option>
          <option value="USD">USD</option>
        </select>
      </label>

      <label className="nr-field">
        Indice de référence
        <input value="S&P 500 (SPX)" readOnly />
      </label>

      <label className="nr-field">
        Plage du graphique
        <select
          value={settings.chartRange}
          onChange={(event) =>
            run("range", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ chartRange: event.target.value }),
              });
              return "Plage enregistrée.";
            })
          }
        >
          <option value="1M">1 mois</option>
          <option value="3M">3 mois</option>
          <option value="YTD">Depuis le 1er janvier</option>
          <option value="1Y">12 mois</option>
        </select>
      </label>

      <label className="nr-field">
        Hauteur du bandeau
        <select
          value={settings.height}
          onChange={(event) =>
            run("height", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ height: event.target.value }),
              });
              return "Hauteur enregistrée.";
            })
          }
        >
          <option value="compact">Compacte</option>
          <option value="standard">Standard</option>
          <option value="tall">Haute</option>
        </select>
      </label>

      <label className="nr-field">
        Bandeau d’alerte
        <select
          value={settings.breakingBanner}
          onChange={(event) =>
            run("banner", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ breakingBanner: event.target.value }),
              });
              return "Affichage des alertes enregistré.";
            })
          }
        >
          <option value="compact">Pastille compacte dans le fil</option>
          <option value="banner">Grand bandeau (ancien)</option>
          <option value="off">Masqué</option>
        </select>
      </label>

      <label className="nr-field">
        Courriel de contact EDGAR
        <input
          type="email"
          value={contactEmail}
          placeholder="nom@domaine.com"
          onChange={(event) => setContactEmail(event.target.value)}
          onBlur={() => {
            if (!settings || contactEmail === settings.contactEmail) return;
            void run("contact", async () => {
              await givernyApi("/api/admin/giverny", csrf, {
                method: "POST",
                body: JSON.stringify({ contactEmail }),
              });
              return "Contact EDGAR enregistré. Relancez l’actualisation 13F.";
            });
          }}
        />
      </label>
      <p className="nr-time">
        La SEC exige un User-Agent déclaré, pas un profil de navigateur. Un
        courriel joignable évite le 403. Le dépôt n’est jamais inventé.
      </p>

      <button
        type="button"
        className="nr-chip"
        disabled={pending === "refresh13f"}
        onClick={() =>
          run("refresh13f", async () => {
            await givernyApi("/api/admin/giverny/refresh", csrf, { method: "POST" });
            return "Actualisation 13F et marchés lancée.";
          })
        }
      >
        Actualiser le 13F maintenant
      </button>

      <h2 className="nr-brand-name" style={{ letterSpacing: "0.18em", fontSize: "0.9rem" }}>
        Import XML 13F
      </h2>
      <p className="nr-time">
        Si EDGAR bloque encore le serveur, téléchargez{" "}
        <code>primary_doc.xml</code> et <code>form13fInfoTable.xml</code> depuis
        sec.gov dans un navigateur, puis importez-les ici.
      </p>
      <label className="nr-field">
        Numéro d’accession (si absent du XML)
        <input
          value={accessionHint}
          placeholder="ex. 0001641864-26-000011"
          autoComplete="off"
          onChange={(event) => setAccessionHint(event.target.value)}
        />
      </label>
      <label className="nr-field">
        Date de dépôt public (si absente du XML)
        <input
          type="date"
          value={filedAtHint}
          onChange={(event) => setFiledAtHint(event.target.value)}
        />
      </label>
      <p className="nr-time">
        C’est la date de publication EDGAR, pas la fin de trimestre du rapport.
      </p>
      <label className="nr-field">
        Fichiers XML
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          disabled={pending === "upload13f"}
          onChange={(event) => {
            const input = event.currentTarget;
            const selected = input.files ? [...input.files] : [];
            input.value = "";
            if (selected.length === 0) return;
            void run("upload13f", async () => {
              const xml = (
                await Promise.all(
                  selected.slice(0, 3).map(async (file) => {
                    if (file.size > 2_000_000) throw new Error("Fichier 13F trop volumineux.");
                    return file.text();
                  }),
                )
              ).join("\n");
              const data = await givernyApi("/api/admin/giverny/filing", csrf, {
                method: "POST",
                body: JSON.stringify({
                  xml,
                  accession: accessionHint || undefined,
                  filedAt: filedAtHint || undefined,
                }),
              });
              return `13F ${data.accession} importé (${data.holdings} titres).`;
            });
          }}
        />
      </label>

      <h2 className="nr-brand-name" style={{ letterSpacing: "0.18em", fontSize: "0.9rem" }}>
        Rendements mensuels officiels
      </h2>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const parsed = Number(officialPct.replace(",", "."));
          if (!month || !Number.isFinite(parsed)) return;
          void run("official", async () => {
            await givernyApi("/api/admin/giverny/official", csrf, {
              method: "POST",
              body: JSON.stringify({
                yearMonth: month,
                officialReturn: parsed / 100,
                note: note || null,
              }),
            });
            setOfficialPct("");
            setNote("");
            return "Mois officiel enregistré. La série synthétique est inchangée.";
          });
        }}
        style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "8rem 8rem 1fr auto" }}
      >
        <input className="nr-field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
        <input
          className="nr-field"
          placeholder="% officiel"
          value={officialPct}
          onChange={(event) => setOfficialPct(event.target.value)}
          required
        />
        <input className="nr-field" placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
        <button type="submit" className="nr-chip">
          Ajouter
        </button>
      </form>

      <table className="nr-table">
        <thead>
          <tr>
            <th>Mois</th>
            <th>Officiel</th>
            <th>Synthétique</th>
            <th>Écart</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(validation?.officialMonths ?? []).length === 0 ? (
            <tr>
              <td colSpan={5} className="nr-time">
                Aucun mois officiel. La série synthétique continue d’être calculée.
              </td>
            </tr>
          ) : (
            validation?.officialMonths.map((row) => (
              <tr key={row.yearMonth}>
                <td>{row.yearMonth}</td>
                <td>{pct(row.officialReturn)}</td>
                <td>{pct(row.syntheticReturn)}</td>
                <td>{pct(row.gap)}</td>
                <td>
                  <button
                    type="button"
                    className="nr-chip"
                    onClick={() =>
                      run("delete-month", async () => {
                        await givernyApi("/api/admin/giverny/official", csrf, {
                          method: "DELETE",
                          body: JSON.stringify({ yearMonth: row.yearMonth }),
                        });
                        return "Mois retiré.";
                      })
                    }
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="nr-time">
        Erreur de suivi {pct(validation?.trackingError ?? null)} · Écart cumulé {pct(validation?.cumulativeGap ?? null)}
      </p>

      <h2 className="nr-brand-name" style={{ letterSpacing: "0.18em", fontSize: "0.9rem" }}>
        Couverture et fournisseurs
      </h2>
      <p className="nr-time">
        Dépôt {validation?.filing?.accession ?? "aucun"} · Appariement{" "}
        {validation?.mappingCoverage == null ? "—" : `${Math.round(validation.mappingCoverage * 100)} %`} · Cours{" "}
        {validation?.priceCoverage == null ? "—" : `${Math.round(validation.priceCoverage * 100)} %`}
      </p>
      {validation?.lastError ? <p className="nr-error">{validation.lastError}</p> : null}
      <ul className="nr-time">
        {(validation?.providers ?? []).map((provider) => (
          <li key={provider.provider}>
            {provider.ok ? "OK" : "Erreur"} · {provider.provider} · {provider.detail}
          </li>
        ))}
      </ul>
      {(validation?.unmapped ?? []).length > 0 ? (
        <p className="nr-time">
          Non appariés : {validation?.unmapped.map((row) => `${row.issuerName} (${row.cusip})`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
