"use client";

import { useState } from "react";

const GARMIN_SSO_URL =
  "https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&source=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountLoginUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountCreationUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed";

// Reuse hevy2garmin's CF Worker for Garmin DI token exchange
const GARMIN_WORKER_BASE = "https://hevy2garmin-exchange-di.gkos.workers.dev";

export default function SetupPage() {
  const [ticketUrl, setTicketUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function exchangeTicket() {
    const raw = ticketUrl.trim();
    if (!raw) {
      setStatus("error");
      setMessage("Paste the URL first.");
      return;
    }

    let ticket = "";
    const match = raw.match(/ticket=([^&\s]+)/);
    if (match) {
      ticket = match[1];
    } else if (raw.startsWith("ST-")) {
      ticket = raw;
    } else {
      setStatus("error");
      setMessage("No ticket found. Make sure you copied the full URL after signing in.");
      return;
    }

    setStatus("loading");
    setMessage("Connecting to Garmin...");

    try {
      const exchResp = await fetch(`${GARMIN_WORKER_BASE}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const exchData = await exchResp.json();

      if (exchData.error) {
        setStatus("error");
        setMessage(exchData.error);
        return;
      }
      if (!exchData.di_token || !exchData.di_refresh_token || !exchData.di_client_id) {
        setStatus("error");
        setMessage("Worker returned unexpected response.");
        return;
      }

      const storeResp = await fetch("/api/connections/garmin/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: {
            di_token: exchData.di_token,
            di_refresh_token: exchData.di_refresh_token,
            di_client_id: exchData.di_client_id,
          },
        }),
      });
      const storeData = await storeResp.json();

      if (storeData.ok) {
        setStatus("success");
        setMessage("Connected to Garmin!");
        setTimeout(() => (window.location.href = "/dashboard"), 3000);
      } else {
        setStatus("error");
        setMessage(storeData.error || "Failed to save tokens.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold">MacroEngine Setup</h1>
          <p className="text-slate-400 mt-2">Connect your Garmin account to get started.</p>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold">Step 1: Sign into Garmin</h2>
          <p className="text-sm text-slate-400">
            Click the button below, sign in, then copy the URL from the page you land on.
          </p>
          <a
            href={GARMIN_SSO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500"
          >
            Sign into Garmin
          </a>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold">Step 2: Paste the URL</h2>
          <p className="text-sm text-slate-400">
            After signing in, copy the URL from your browser (it contains a ticket=ST-... parameter).
          </p>
          <input
            type="text"
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
            placeholder="https://sso.garmin.com/sso/embed?ticket=ST-..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={exchangeTicket}
            disabled={status === "loading"}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "loading" ? "Connecting..." : "Connect Garmin"}
          </button>

          {message && (
            <p
              className={`text-sm ${
                status === "success"
                  ? "text-green-400"
                  : status === "error"
                    ? "text-red-400"
                    : "text-slate-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        <div className="text-center">
          <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300">
            Skip for now (no Garmin data)
          </a>
        </div>
      </div>
    </main>
  );
}
