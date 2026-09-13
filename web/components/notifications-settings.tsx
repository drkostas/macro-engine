"use client";

import { useState, useSyncExternalStore } from "react";
import { InfoTip } from "./info-tip";

interface Reminder {
  id: string;
  label: string;
  time: string; // HH:MM
  enabled: boolean;
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: "breakfast", label: "Log breakfast", time: "08:00", enabled: false },
  { id: "lunch", label: "Log lunch", time: "13:00", enabled: false },
  { id: "dinner", label: "Log dinner", time: "19:00", enabled: false },
  { id: "close_day", label: "Close today's day", time: "22:00", enabled: false },
  { id: "weigh_in", label: "Weigh in (morning)", time: "07:00", enabled: false },
];

const STORAGE_KEY = "macroengine_reminders";

// The browser's permission and the stored reminders are external values, read through
// useSyncExternalStore (the server snapshot is the default, the client snapshot the real thing)
// instead of copied into state inside an effect. The reminders snapshot is cached on the raw
// string so the store returns the same reference while nothing changed.
const subscribeNoop = () => () => {};
function readPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}
let remindersCache: { raw: string | null; value: Reminder[] } = { raw: null, value: DEFAULT_REMINDERS };
function readStoredReminders(): Reminder[] {
  const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (raw === remindersCache.raw) return remindersCache.value;
  let value = DEFAULT_REMINDERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Reminder[];
      // Merge with defaults so new reminder types appear
      value = DEFAULT_REMINDERS.map((def) => {
        const saved = parsed.find((r) => r.id === def.id);
        return saved ? { ...def, ...saved } : def;
      });
    } catch { /* ignore */ }
  }
  remindersCache = { raw, value };
  return value;
}

export function NotificationsSettings() {
  const envPermission = useSyncExternalStore(subscribeNoop, readPermission, () => "default" as const);
  const [granted, setPermission] = useState<NotificationPermission | null>(null);
  const permission = granted ?? envPermission;
  const stored = useSyncExternalStore(subscribeNoop, readStoredReminders, () => DEFAULT_REMINDERS);
  const [edited, setReminders] = useState<Reminder[] | null>(null);
  const reminders = edited ?? stored;

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      new Notification("MacroEngine reminders enabled", {
        body: "You'll get pings at your configured times.",
        icon: "/icon-192.png",
      });
    }
  };

  const saveReminders = (next: Reminder[]) => {
    setReminders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleReminder = (id: string) => {
    saveReminders(reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const updateTime = (id: string, time: string) => {
    saveReminders(reminders.map((r) => (r.id === id ? { ...r, time } : r)));
  };

  const testNotification = () => {
    if (permission !== "granted") return;
    new Notification("Test from MacroEngine", {
      body: "Notifications are working. You'll be pinged at your set times.",
      icon: "/icon-192.png",
    });
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-3 flex items-center">
        Reminders
        <InfoTip text="Local notifications fired from your browser when the app is open. Background push (when app is closed) requires server setup - coming soon." />
      </h2>

      {/* Permission state */}
      {permission === "unsupported" && (
        <div className="bg-warm-bg/50 border border-warm-dim rounded-lg p-3 mb-3">
          <p className="text-xs text-warm">Notifications not supported in this browser.</p>
        </div>
      )}

      {permission === "default" && (
        <div className="bg-teal-bg/50 border border-teal-dim rounded-lg p-3 mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text">Enable browser notifications</p>
            <p className="text-[11px] text-text-muted mt-0.5">Required for reminders to work.</p>
          </div>
          <button
            onClick={requestPermission}
            className="text-xs bg-teal-dim hover:bg-teal text-white px-3 py-2 rounded-lg font-medium shrink-0"
          >
            Enable
          </button>
        </div>
      )}

      {permission === "denied" && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-3">
          <p className="text-xs text-danger">Notifications blocked. Enable in your browser settings to use reminders.</p>
        </div>
      )}

      {permission === "granted" && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-success">✓ Permission granted</span>
          <button
            onClick={testNotification}
            className="text-[11px] text-teal hover:text-teal-light"
          >
            Send test
          </button>
        </div>
      )}

      {/* Reminder list */}
      <div className="space-y-1">
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => toggleReminder(r.id)}
                disabled={permission !== "granted"}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                  r.enabled ? "bg-teal" : "bg-surface-elevated"
                } disabled:opacity-40`}
                aria-label={`Toggle ${r.label}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    r.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-text truncate">{r.label}</span>
            </div>
            <input
              type="time"
              value={r.time}
              onChange={(e) => updateTime(r.id, e.target.value)}
              disabled={!r.enabled || permission !== "granted"}
              className="bg-surface-elevated border border-border-glow rounded-lg px-2 py-1 text-sm text-text focus:outline-none focus:border-teal-dim disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted mt-3">
        Note: Reminders fire only while MacroEngine is open in a browser tab or as a PWA.
        For reminders when the app is closed, we need push notifications (requires server setup).
      </p>
    </div>
  );
}
