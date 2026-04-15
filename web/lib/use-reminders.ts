"use client";

import { useEffect } from "react";

interface Reminder {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
}

const STORAGE_KEY = "macroengine_reminders";
const FIRED_KEY = "macroengine_reminders_fired";

/**
 * Client-side reminder scheduler.
 * Checks every minute whether any reminder is due.
 * Fires at most once per reminder per day (tracked in localStorage).
 * Only runs when the browser tab is open.
 */
export function useReminders() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const check = () => {
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;
      const today = now.toISOString().split("T")[0];

      let reminders: Reminder[] = [];
      try {
        reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      } catch { return; }

      let fired: Record<string, string> = {};
      try {
        fired = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
      } catch { /* ignore */ }

      for (const r of reminders) {
        if (!r.enabled) continue;
        if (r.time !== currentTime) continue;
        // Already fired today?
        if (fired[r.id] === today) continue;

        try {
          new Notification(r.label, {
            body: `Scheduled reminder at ${r.time}`,
            icon: "/icon-192.png",
            tag: `me-${r.id}`,
          });
          fired[r.id] = today;
        } catch { /* ignore */ }
      }

      localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    };

    // Check immediately on mount, then every 60s
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);
}
