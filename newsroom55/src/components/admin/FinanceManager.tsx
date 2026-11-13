"use client";

import { FormEvent, useEffect, useState } from "react";
import { resolveListedInstrument } from "@/lib/markets/resolve";

type SymbolRow = {
  id: number;
  symbol: string;
  display_name: string;
  kind: string;
  currency: string;
  provider_symbol: string;
  quote_provider: "cboe" | "twelvedata" | "finnhub";
  exchange: string | null;
  enabled: number;
};

type SearchResult = {
  symbol: string;
  providerSymbol: string;
  name: string;
  kind: "equity" | "fund";
  currency: string;
  exchange: string | null;
  country: string;
  instrumentType: string;
  quoteProvider: "cboe" | "twelvedata" | "finnhub";
  twelveSymbol?: string;
  finnhubSymbol?: string;
  cboeEligible?: boolean;
  micCode?: string | null;
};

type ProviderInfo = {
  id: string;
  name: string;
  configured: boolean;
  globalSearch: boolean;
  refreshMinutes: number;
  twelveRefreshMinutes: number;
  maxSymbols: number | null;
  twelveConfigured: boolean;
  finnhubConfigured: boolean;
};

function supportedByProvider(symbol: SymbolRow, provider: ProviderInfo | null): boolean {
  if (symbol.kind === "fx-public") return provider?.id === "bankofcanada";
  if (provider?.id === "hybrid") {
    if (symbol.quote_provider === "cboe") return true;
    if (symbol.quote_provider === "twelvedata") return Boolean(provider.twelveConfigured);
    if (symbol.quote_provider === "finnhub") return Boolean(provider.finnhubConfigured);
    return false;
  }
  if (provider?.id === "finnhub") return symbol.quote_provider === "finnhub" || Boolean(provider.finnhubConfigured);
  return symbol.quote_provider === provider?.id;
}

function providerLabel(id: "cboe" | "twelvedata" | "finnhub") {
  if (id === "cboe") return "Cboe · gratuit, États-Unis";
  if (id === "finnhub") return "Finnhub · quota de votre forfait";
  return "Twelve Data · quota protégé";
}

async function financeApi(path: string, csrf: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function FinanceManager({ csrf }: { csrf: string }) {
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [query, setQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState<"cboe" | "twelvedata" | "finnhub">("cboe");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchNote, setSearchNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await financeApi("/api/admin/symbols", csrf);
    setSymbols(data.symbols);
    setProvider(data.provider);
  }

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Chargement impossible"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setPending("search");
    setError("");
    setMessage("");
    try {
      const data = await financeApi(
        `/api/admin/symbols/search?q=${encodeURIComponent(value)}&provider=${searchProvider}`,
        csrf,
      );
      setResults(
        data.results.map((result: Omit<SearchResult, "quoteProvider">) => ({
          ...result,
          quoteProvider: data.provider,
        })),
      );
      setSearchNote(data.note);
      if (data.results.length === 0) {
        setMessage("Aucun instrument correspondant n’a été retourné par le fournisseur.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recherche impossible");
      setResults([]);
    } finally {
      setPending(null);
    }
  }

  async function run(key: string, action: () => Promise<string>) {
    setPending(key);
    setError("");
    setMessage("");
    try {
      const success = await action();
      setMessage(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La commande a échoué");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="finance-manager">
      <header className="finance-manager-hero">
        <div>
          <div className="nr-kicker">Ticker financier · sélection assistée</div>
          <h2>Actions et fonds</h2>
          <p>
            Recherchez une entreprise ou un FNB par son nom. Le symbole, la devise et la
            place boursière sont ajoutés automatiquement.
          </p>
        </div>
        <div className="finance-provider">
          <span>FOURNISSEURS ACTIFS</span>
          <strong>{provider?.name ?? "Chargement…"}</strong>
          <small>
            Cboe gratuit · Twelve Data{" "}
            {provider?.twelveConfigured
              ? `${provider.maxSymbols ?? 6} titres / ${provider.twelveRefreshMinutes} min`
              : "non configuré"}
            {" · Finnhub "}
            {provider?.finnhubConfigured ? "configuré" : "non configuré"}
          </small>
        </div>
      </header>

      {message ? <div className="tv-notice tv-notice-ok">{message}</div> : null}
      {error ? <div className="tv-notice tv-notice-error">{error}</div> : null}

      <section className="finance-search-panel">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">01</span>
            <div>
              <h3>Trouver un instrument</h3>
              <p>Exemples : Cisco, Banque Royale, S&P 500 ETF, Shopify.</p>
            </div>
          </div>
        </div>
        <div className="finance-provider-picker" role="group" aria-label="Fournisseur de recherche">
          <button
            type="button"
            className={`nr-chip ${searchProvider === "cboe" ? "nr-chip-on" : ""}`}
            onClick={() => {
              setSearchProvider("cboe");
              setResults([]);
              setSearchNote("");
            }}
          >
            Cboe · États-Unis gratuit
          </button>
          <button
            type="button"
            className={`nr-chip ${searchProvider === "twelvedata" ? "nr-chip-on" : ""}`}
            disabled={!provider?.twelveConfigured}
            onClick={() => {
              setSearchProvider("twelvedata");
              setResults([]);
              setSearchNote("");
            }}
          >
            Twelve Data · international
          </button>
          <button
            type="button"
            className={`nr-chip ${searchProvider === "finnhub" ? "nr-chip-on" : ""}`}
            disabled={!provider?.finnhubConfigured}
            onClick={() => {
              setSearchProvider("finnhub");
              setResults([]);
              setSearchNote("");
            }}
          >
            Finnhub · Yahoo (.TO)
          </button>
        </div>
        <form className="finance-search" onSubmit={search}>
          <input
            aria-label="Rechercher une entreprise ou un fonds"
            placeholder="Nom de l’entreprise ou du fonds…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="nr-chip nr-chip-accent"
            disabled={pending !== null || query.trim().length < 2}
          >
            {pending === "search" ? "Recherche…" : "Rechercher"}
          </button>
        </form>
        {searchNote ? <p className="finance-search-note">{searchNote}</p> : null}
        {results.length ? (
          <div className="finance-results">
            {results.map((result) => {
              const key = `${result.providerSymbol}-${result.exchange || ""}`;
              const alreadyAdded = symbols.some(
                (symbol) =>
                  symbol.symbol === result.symbol &&
                  symbol.currency === result.currency,
              );
              return (
                <article key={key}>
                  <div className="finance-result-symbol">
                    <strong>{result.symbol}</strong>
                    <span>{result.currency}</span>
                  </div>
                  <div className="finance-result-info">
                    <strong>{result.name}</strong>
                    <span>
                      {result.exchange || "Bourse non précisée"}
                      {result.micCode ? ` · ${result.micCode}` : ""} · {result.country}
                    </span>
                    <small>
                      {result.instrumentType} · Twelve Data {result.twelveSymbol || result.symbol}
                      {result.exchange ? ` @ ${result.exchange}` : ""} · Finnhub{" "}
                      {result.finnhubSymbol || result.symbol}
                      {result.cboeEligible ? " · Cboe oui" : " · Cboe non"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={`nr-chip ${alreadyAdded ? "nr-chip-on" : ""}`}
                    disabled={pending !== null || alreadyAdded}
                    onClick={() =>
                      void run(`add-${key}`, async () => {
                        await financeApi("/api/admin/symbols", csrf, {
                          method: "POST",
                          body: JSON.stringify({
                            symbol: result.symbol,
                            display_name: result.name,
                            kind: result.kind,
                            currency: result.currency,
                            provider_symbol: result.providerSymbol,
                            exchange: result.exchange,
                            quote_provider: result.quoteProvider,
                          }),
                        });
                        return `${result.name} ajouté au ticker. La cotation apparaîtra au prochain cycle.`;
                      })
                    }
                  >
                    {pending === `add-${key}`
                      ? "Ajout…"
                      : alreadyAdded
                        ? "Déjà ajouté"
                        : "Ajouter au ticker"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="finance-watchlist">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">02</span>
            <div>
              <h3>Contenu du ticker</h3>
              <p>
                {
                  symbols.filter(
                    (symbol) => symbol.enabled && supportedByProvider(symbol, provider),
                  ).length
                }{" "}
                instrument(s) affiché(s) par leurs fournisseurs respectifs.
              </p>
            </div>
          </div>
        </div>
        <div className="finance-symbol-list">
          {symbols
            .filter((symbol) => symbol.kind !== "fx-public")
            .map((symbol) => {
              const listed = resolveListedInstrument(
                symbol.symbol,
                symbol.exchange,
                symbol.provider_symbol,
                symbol.currency,
                symbol.kind,
              );
              return (
              <article className={symbol.enabled ? "is-enabled" : ""} key={symbol.id}>
                <div className="finance-result-symbol">
                  <strong>{symbol.symbol}</strong>
                  <span>{symbol.currency}</span>
                </div>
                <div className="finance-result-info">
                  <strong>{symbol.display_name}</strong>
                  <span>
                    {listed.exchange || "Bourse non précisée"}
                    {listed.micCode ? ` · ${listed.micCode}` : ""} · envoyé {symbol.provider_symbol}
                  </span>
                  <small>
                    {providerLabel(symbol.quote_provider)} · Twelve {listed.twelveSymbol}
                    {listed.twelveExchange ? `@${listed.twelveExchange}` : ""} · Finnhub{" "}
                    {listed.finnhubSymbol}
                    {listed.cboeEligible ? " · Cboe oui" : " · Cboe non"}
                  </small>
                </div>
                <div className="finance-symbol-actions">
                  <select
                    aria-label={`Fournisseur de ${symbol.display_name}`}
                    value={symbol.quote_provider}
                    disabled={pending !== null}
                    onChange={(event) => {
                      const quoteProvider = event.target.value as
                        | "cboe"
                        | "twelvedata"
                        | "finnhub";
                      void run(`provider-${symbol.id}`, async () => {
                        await financeApi(`/api/admin/symbols/${symbol.id}`, csrf, {
                          method: "PATCH",
                          body: JSON.stringify({ quote_provider: quoteProvider }),
                        });
                        return `${symbol.display_name} utilisera ${
                          quoteProvider === "cboe"
                            ? "Cboe"
                            : quoteProvider === "finnhub"
                              ? "Finnhub"
                              : "Twelve Data"
                        }.`;
                      });
                    }}
                  >
                    <option
                      value="cboe"
                      disabled={
                        symbol.currency !== "USD" ||
                        (symbol.kind !== "equity" && symbol.kind !== "fund")
                      }
                    >
                      Cboe
                    </option>
                    <option value="twelvedata" disabled={!provider?.twelveConfigured}>
                      Twelve Data
                    </option>
                    <option value="finnhub" disabled={!provider?.finnhubConfigured}>
                      Finnhub
                    </option>
                  </select>
                  <button
                    type="button"
                    className={`nr-chip ${
                      symbol.enabled && supportedByProvider(symbol, provider) ? "nr-chip-on" : ""
                    }`}
                    disabled={pending !== null || !supportedByProvider(symbol, provider)}
                    onClick={() =>
                      void run(`toggle-${symbol.id}`, async () => {
                        await financeApi(`/api/admin/symbols/${symbol.id}`, csrf, {
                          method: "PATCH",
                          body: JSON.stringify({ enabled: !symbol.enabled }),
                        });
                        return symbol.enabled
                          ? `${symbol.display_name} masqué.`
                          : `${symbol.display_name} affiché.`;
                      })
                    }
                  >
                    {!supportedByProvider(symbol, provider)
                      ? "Non disponible"
                      : symbol.enabled
                        ? "Affiché"
                        : "Masqué"}
                  </button>
                  <button
                    type="button"
                    className="finance-remove"
                    aria-label={`Retirer ${symbol.display_name}`}
                    disabled={pending !== null}
                    onClick={() =>
                      void run(`delete-${symbol.id}`, async () => {
                        await financeApi(`/api/admin/symbols/${symbol.id}`, csrf, {
                          method: "DELETE",
                        });
                        return `${symbol.display_name} retiré.`;
                      })
                    }
                  >
                    Retirer
                  </button>
                </div>
              </article>
            );
            })}
        </div>
      </section>

      <aside className="finance-global-note">
        <strong>
          Routage automatique par instrument
        </strong>
        <p>
          Sélectionnez Cboe pour les actions et FNB américains : aucune clé n’est requise.
          Pour un titre TSX tel que XEQT.TO, NEWSROOM envoie <code>XEQT</code> +
          bourse <code>TSX</code> / MIC <code>XTSE</code> à Twelve Data, et
          <code> XEQT.TO</code> à Finnhub. Cboe ne cote pas le TSX. Twelve Data est
          limité à <code>{provider?.maxSymbols ?? 6} instruments</code> et une
          actualisation toutes les <code>{provider?.twelveRefreshMinutes ?? 30} minutes</code>.
          Un cours manquant reste <strong>INDISPONIBLE</strong> — jamais un zéro inventé.
          Les droits canadiens dépendent du forfait de chaque fournisseur.
        </p>
      </aside>
    </div>
  );
}
