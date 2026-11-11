"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="nr-login">
      <div className="nr-login-card">
        <div className="nr-kicker">Desk fault</div>
        <h1>CENTRE DE NOUVELLES</h1>
        <p className="nr-error">The board could not render this view. No invented data is shown.</p>
        <button type="button" className="nr-chip" onClick={reset}>
          Retry
        </button>
      </div>
    </div>
  );
}
