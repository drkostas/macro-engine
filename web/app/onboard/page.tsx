"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardPage() {
  const router = useRouter();
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("177");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState("male");
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("lose");
  const [deficit, setDeficit] = useState("500");
  const [targetBf, setTargetBf] = useState("15");
  const [targetDate, setTargetDate] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "active" | "very_active">("active");
  const [stepGoal, setStepGoal] = useState("10000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const weightKg = parseFloat(weight);
    const heightCm = parseFloat(height);
    const ageNum = parseInt(age);
    const deficitNum = parseInt(deficit);

    // Simple BMR estimate (Mifflin-St Jeor)
    const bmr = sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161;
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2, light: 1.375, active: 1.55, very_active: 1.725,
    };
    const activityMultiplier = activityMultipliers[activityLevel] ?? 1.55;
    const tdee = Math.round(bmr * activityMultiplier);

    // BF% estimate (rough)
    const bmi = weightKg / ((heightCm / 100) ** 2);
    const estimatedBf = sex === "male"
      ? Math.round((1.2 * bmi + 0.23 * ageNum - 16.2) * 10) / 10
      : Math.round((1.2 * bmi + 0.23 * ageNum - 5.4) * 10) / 10;

    const ffm = weightKg * (1 - estimatedBf / 100);

    try {
      const resp = await fetch("/api/nutrition/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight_kg: weightKg,
          height_cm: heightCm,
          age: ageNum,
          sex,
          goal,
          tdee_estimate: tdee,
          daily_deficit: goal === "maintain" ? 0 : deficitNum,
          estimated_bf_pct: estimatedBf,
          target_bf_pct: parseFloat(targetBf),
          estimated_ffm_kg: Math.round(ffm * 10) / 10,
          protein_g_per_kg: 2.2,
          fat_g_per_kg: 0.8,
          step_goal: parseInt(stepGoal) || 10000,
          activity_level: activityLevel,
          target_date: targetDate || null,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Failed to save");
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="text-text-secondary mt-1 text-sm">
            We&apos;ll calculate your targets from this info.
          </p>
        </div>

        {/* Body */}
        <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text">Body</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Weight (kg)</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Height (cm)</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)}
                className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
                className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            {(["male", "female"] as const).map((s) => (
              <button key={s} onClick={() => setSex(s)}
                className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                  sex === s ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"
                }`}>
                {s === "male" ? "Male" : "Female"}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Activity level</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: "sedentary", label: "Sedentary" },
                { key: "light", label: "Light" },
                { key: "active", label: "Active" },
                { key: "very_active", label: "Very Active" },
              ] as const).map((a) => (
                <button key={a.key} onClick={() => setActivityLevel(a.key)}
                  className={`py-2 text-xs rounded-lg transition-colors ${
                    activityLevel === a.key ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"
                  }`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text">Goal</h2>
          <div className="flex gap-2">
            {([
              { key: "lose", label: "Lose Fat", color: "text-danger" },
              { key: "maintain", label: "Maintain", color: "text-blue-400" },
              { key: "gain", label: "Build Muscle", color: "text-emerald-400" },
            ] as const).map((g) => (
              <button key={g.key} onClick={() => setGoal(g.key)}
                className={`flex-1 py-2.5 text-sm rounded-lg border transition-colors ${
                  goal === g.key ? "bg-surface-elevated border-slate-600 " + g.color : "border-border text-text-muted"
                }`}>
                {g.label}
              </button>
            ))}
          </div>

          {goal !== "maintain" && (
            <div>
              <label className="text-xs text-text-muted block mb-1">
                Daily {goal === "lose" ? "deficit" : "surplus"} (kcal)
              </label>
              <div className="flex gap-2">
                {["300", "500", "800"].map((d) => (
                  <button key={d} onClick={() => setDeficit(d)}
                    className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                      deficit === d ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted block mb-1">Target body fat %</label>
            <input type="number" value={targetBf} onChange={(e) => setTargetBf(e.target.value)}
              className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Target date (optional)</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm text-text" />
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Daily step goal</label>
            <input type="number" value={stepGoal} onChange={(e) => setStepGoal(e.target.value)}
              className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button onClick={handleSubmit} disabled={saving}
          className="w-full bg-teal-dim hover:bg-teal text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Calculate My Targets"}
        </button>
      </div>
    </main>
  );
}
