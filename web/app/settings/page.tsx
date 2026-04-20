"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { NotificationsSettings } from "@/components/notifications-settings";

interface Profile {
  weight_kg: number;
  height_cm: number | null;
  age: number | null;
  sex: string | null;
  goal: string | null;
  daily_deficit: number;
  protein_g_per_kg: number;
  fat_g_per_kg: number;
  estimated_bf_pct: number | null;
  target_bf_pct: number | null;
  target_date: string | null;
  step_goal: number;
  tdee_estimate: number | null;
  activity_level: string | null;
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "macros", label: "Macros & Deficit" },
  { id: "goals", label: "Goals" },
  { id: "activity", label: "Activity" },
  { id: "reminders", label: "Reminders" },
  { id: "milestones", label: "Milestones" },
  { id: "integrations", label: "Integrations" },
] as const;

interface MilestoneEntry {
  id: string;
  label: string;
  achieved: boolean;
  achieved_at: string | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<typeof SECTIONS[number]["id"]>("profile");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nutrition/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile(d.profile);
      })
      .finally(() => setLoading(false));
  }, []);

  const update = async (field: keyof Profile, value: unknown) => {
    if (!profile) return;
    setSaving(field);
    setProfile({ ...profile, [field]: value as never });
    try {
      await fetch("/api/nutrition/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      setSaved(field);
      setTimeout(() => setSaved((s) => (s === field ? null : s)), 1500);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-surface-elevated rounded w-48" />
          <div className="h-64 bg-surface-elevated rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 max-w-4xl mx-auto text-center mt-10">
        <p className="text-text-muted">No profile yet.</p>
        <Link href="/onboard" className="inline-block mt-4 bg-teal-dim text-white px-4 py-2 rounded-lg text-sm">
          Complete onboarding
        </Link>
      </main>
    );
  }

  const FieldRow = ({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex items-center min-w-0 flex-shrink">
        <span className="text-sm text-text-secondary">{label}</span>
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );

  const NumberInput = ({
    value, onChange, step = 1, min, max, unit, width = "w-20",
  }: {
    value: number | null;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    max?: number;
    unit?: string;
    width?: string;
  }) => (
    <>
      <input
        type="number"
        value={value ?? ""}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${width} bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text text-right focus:outline-none focus:border-teal-dim`}
      />
      {unit && <span className="text-xs text-text-muted w-8">{unit}</span>}
    </>
  );

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">Settings</h1>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-surface-elevated rounded-lg p-0.5 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[40px] ${
              section === s.id
                ? "bg-surface-hover text-text"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="glass-elevated rounded-2xl p-4 md:p-5">
        {section === "profile" && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-2">Personal info</h2>
            <FieldRow label="Weight" tip="Current bodyweight. Updates automatically when a new weigh-in is recorded.">
              <NumberInput value={profile.weight_kg} step={0.1} min={30} max={300} unit="kg" onChange={(v) => update("weight_kg", v)} />
            </FieldRow>
            <FieldRow label="Height">
              <NumberInput value={profile.height_cm} step={1} min={100} max={250} unit="cm" onChange={(v) => update("height_cm", v)} />
            </FieldRow>
            <FieldRow label="Age">
              <NumberInput value={profile.age} step={1} min={10} max={120} unit="yrs" onChange={(v) => update("age", v)} />
            </FieldRow>
            <FieldRow label="Sex">
              <select
                value={profile.sex ?? ""}
                onChange={(e) => update("sex", e.target.value)}
                className="bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
              >
                <option value="">-</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </FieldRow>
            <FieldRow label="Current BF%" tip="Body fat percentage. Used with weight to compute lean mass and goal weight.">
              <NumberInput value={profile.estimated_bf_pct} step={0.1} min={3} max={60} unit="%" onChange={(v) => update("estimated_bf_pct", v)} />
            </FieldRow>
          </div>
        )}

        {section === "macros" && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-2">Macro targets</h2>
            <FieldRow label="Protein" tip="Grams of protein per kg of bodyweight. 2.0-2.4 g/kg is recommended for fat loss with training.">
              <NumberInput value={profile.protein_g_per_kg} step={0.1} min={0.5} max={4} unit="g/kg" width="w-16" onChange={(v) => update("protein_g_per_kg", v)} />
            </FieldRow>
            <FieldRow label="Fat" tip="Minimum fat intake per kg of bodyweight. Carbs fill in the rest after protein and fat.">
              <NumberInput value={profile.fat_g_per_kg} step={0.1} min={0.4} max={2.5} unit="g/kg" width="w-16" onChange={(v) => update("fat_g_per_kg", v)} />
            </FieldRow>
            <FieldRow label="Daily deficit" tip="Calories below maintenance. 500 = slow loss, 800 = aggressive loss. Auto-adjusts based on weight trend.">
              <NumberInput value={profile.daily_deficit} step={50} min={0} max={1200} unit="kcal" onChange={(v) => update("daily_deficit", v)} />
            </FieldRow>
            <FieldRow label="TDEE estimate" tip="Total Daily Energy Expenditure fallback. Used when no Garmin BMR is available. Overridden by real data when available.">
              <NumberInput value={profile.tdee_estimate} step={50} min={1000} max={5000} unit="kcal" onChange={(v) => update("tdee_estimate", v)} />
            </FieldRow>
          </div>
        )}

        {section === "goals" && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-2">Weight & body comp goals</h2>
            <FieldRow label="Goal" tip="Overall direction. Affects how aggressive the deficit is.">
              <select
                value={profile.goal ?? "lose"}
                onChange={(e) => update("goal", e.target.value)}
                className="bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
              >
                <option value="lose">Lose fat</option>
                <option value="maintain">Maintain</option>
                <option value="gain">Gain muscle</option>
              </select>
            </FieldRow>
            <FieldRow label="Target BF%" tip="Your goal body fat percentage. Combined with lean mass, this determines your target weight.">
              <NumberInput value={profile.target_bf_pct} step={0.5} min={5} max={40} unit="%" onChange={(v) => update("target_bf_pct", v)} />
            </FieldRow>
            <FieldRow label="Target date" tip="When you want to reach the goal. Deficit auto-scales based on time remaining.">
              <input
                type="date"
                value={profile.target_date ?? ""}
                onChange={(e) => update("target_date", e.target.value)}
                className="bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
              />
            </FieldRow>
          </div>
        )}

        {section === "activity" && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-2">Activity defaults</h2>
            <FieldRow label="Daily step goal" tip="Expected daily steps. Used to estimate NEAT calories when actual Garmin data is not yet available for the day.">
              <NumberInput value={profile.step_goal} step={500} min={0} max={30000} unit="" width="w-24" onChange={(v) => update("step_goal", v)} />
            </FieldRow>
            <FieldRow label="Activity level" tip="Baseline activity descriptor. Affects BMR multipliers when no Garmin data is available.">
              <select
                value={profile.activity_level ?? "active"}
                onChange={(e) => update("activity_level" as keyof Profile, e.target.value)}
                className="bg-surface-elevated border border-border-glow rounded-lg px-3 py-1.5 text-sm text-text"
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly active</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </FieldRow>
          </div>
        )}

        {section === "reminders" && <NotificationsSettings />}

        {section === "milestones" && <MilestonesSection />}

        {section === "integrations" && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-3">Connected services</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-base/50 rounded-lg p-3">
                <div>
                  <p className="text-sm text-text font-medium">Garmin Connect</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Steps, BMR, runs, heart rate, body metrics</p>
                </div>
                <Link href="/setup" className="text-xs bg-teal-dim hover:bg-teal text-white px-3 py-2 rounded-lg font-medium">
                  Manage
                </Link>
              </div>
              <div className="flex items-center justify-between bg-base/50 rounded-lg p-3 opacity-60">
                <div>
                  <p className="text-sm text-text font-medium">Hevy</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Gym workouts auto-synced via workout_enrichment</p>
                </div>
                <span className="text-[10px] text-success bg-teal-bg px-2 py-1 rounded-full">Active</span>
              </div>
              <div className="flex items-center justify-between bg-base/50 rounded-lg p-3 opacity-60">
                <div>
                  <p className="text-sm text-text font-medium">Strava</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Not yet supported</p>
                </div>
                <span className="text-[10px] text-text-muted">Coming soon</span>
              </div>
            </div>
          </div>
        )}

        {saving && (
          <p className="text-[10px] text-text-muted mt-3">Saving {saving}...</p>
        )}
        {saved && !saving && (
          <p className="text-[10px] text-success mt-3">✓ {saved} saved</p>
        )}
      </div>

      {/* Additional actions */}
      <div className="glass-elevated rounded-2xl p-4 md:p-5">
        <h2 className="text-sm font-semibold text-text mb-3">Data</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/nutrition/export"
            download="macroengine-export.csv"
            className="text-xs bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text px-3 py-2 rounded-lg border border-border-glow transition-colors"
          >
            Export CSV
          </a>
        </div>
      </div>
    </main>
  );
}

function MilestonesSection() {
  const [items, setItems] = useState<MilestoneEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/nutrition/milestones", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.all) ? d.all : []))
      .catch(() => setItems([]));
  }, []);

  if (items === null) {
    return <p className="text-xs text-text-muted">Loading…</p>;
  }

  const achieved = items.filter((m) => m.achieved);
  const locked = items.filter((m) => !m.achieved);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-3">
        Milestones
        <span className="ml-2 text-[11px] text-text-muted font-normal">
          {achieved.length} of {items.length} unlocked
        </span>
      </h2>
      <div className="space-y-2">
        {achieved.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between bg-warm/10 border border-warm/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true">🏆</span>
              <span className="text-sm text-text">{m.label}</span>
            </div>
            {m.achieved_at && (
              <span className="text-[10px] text-text-muted">
                {new Date(m.achieved_at).toLocaleDateString()}
              </span>
            )}
          </div>
        ))}
        {locked.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between bg-base/30 border border-border-subtle rounded-lg p-3 opacity-60"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true">🔒</span>
              <span className="text-sm text-text-muted">{m.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
