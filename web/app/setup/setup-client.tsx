"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GARMIN_SSO_URL =
  "https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&source=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountLoginUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountCreationUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed";

// Reuse hevy2garmin's CF Worker for Garmin DI token exchange
const GARMIN_WORKER_BASE = "https://garmin-auth-sso.gkos.workers.dev";

interface Props {
  garminEnabled: boolean;
}

export function SetupClient({ garminEnabled }: Props) {
  const router = useRouter();
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
        setTimeout(() => router.push("/dashboard"), 3000);
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
          <p className="text-text-secondary mt-2">Connect your Garmin account to get started.</p>
        </div>

        {garminEnabled ? (
          <>
            <div className="bg-surface rounded-xl p-6 border border-border space-y-4">
              <h2 className="text-lg font-semibold">Step 1: Sign into Garmin</h2>
              <p className="text-sm text-text-secondary">
                Click the button below, sign in, then copy the URL from the page you land on.
              </p>
              <a
                href={GARMIN_SSO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-teal-dim text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal"
              >
                Sign into Garmin
              </a>
            </div>

            <div className="bg-surface rounded-xl p-6 border border-border space-y-4">
              <h2 className="text-lg font-semibold">Step 2: Paste the URL</h2>
              <p className="text-sm text-text-secondary">
                After signing in, copy the URL from your browser (it contains a ticket=ST-...
                parameter).
              </p>
              <input
                type="text"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://sso.garmin.com/sso/embed?ticket=ST-..."
                className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={exchangeTicket}
                disabled={status === "loading"}
                className="bg-teal-dim text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal disabled:opacity-50"
              >
                {status === "loading" ? "Connecting..." : "Connect Garmin"}
              </button>

              {message && (
                <p
                  className={`text-sm ${
                    status === "success"
                      ? "text-green-400"
                      : status === "error"
                        ? "text-danger"
                        : "text-text-secondary"
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-surface rounded-xl p-6 border border-border space-y-2 opacity-60">
            <h2 className="text-lg font-semibold text-text-muted">Garmin Connect</h2>
            <p className="text-sm text-text-muted">
              Garmin integration is disabled. Set <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded">GARMIN_AUTH_PROXY_URL</code> in
              your .env to enable.
            </p>
          </div>
        )}

        <div className="text-center">
          <a href="/dashboard" className="text-sm text-text-muted hover:text-text">
            Skip for now (no Garmin data)
          </a>
        </div>
      </div>
    </main>
  );
}
