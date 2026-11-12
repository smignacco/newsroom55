"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password");
        setPending(false);
        return;
      }
      const requested = new URLSearchParams(window.location.search).get("next");
      window.location.assign(requested === "/remote" ? "/remote" : "/admin");
    } catch {
      setError("Network error");
      setPending(false);
    }
  }

  return (
    <div className="nr-login">
      <form className="nr-login-card" onSubmit={onSubmit}>
        <div className="nr-kicker">Restricted</div>
        <h1>CENTRE DE NOUVELLES</h1>
        <p className="nr-wait-sub">Administration desk</p>
        <label className="nr-field">
          Username
          <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="nr-field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="nr-error">{error}</p> : null}
        <button type="submit" className="nr-chip" disabled={pending}>
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
