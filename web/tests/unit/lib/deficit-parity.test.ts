import { describe, it, expect } from "vitest";
import { computeDeficitFromGoal } from "@macro-engine/core/deficit";
import golden from "../../fixtures/golden_deficit.json";

describe("computeDeficitFromGoal — Python parity (golden fixtures)", () => {
  it("matches all 320 Python golden cases exactly", () => {
    let mismatches: string[] = [];
    for (const c of golden as Array<{ in: any; out: any }>) {
      const got = computeDeficitFromGoal({
        weightKg: c.in.weightKg, currentBfPct: c.in.currentBfPct,
        targetBfPct: c.in.targetBfPct, targetDate: c.in.targetDate, today: c.in.today,
      });
      const exp = c.out;
      if (got.daily_deficit !== exp.daily_deficit || got.fat_to_lose_kg !== exp.fat_to_lose_kg ||
          got.timeline_weeks !== exp.timeline_weeks || got.weekly_rate_pct !== exp.weekly_rate_pct ||
          got.safety !== exp.safety) {
        mismatches.push(`in=${JSON.stringify(c.in)} exp=${JSON.stringify(exp)} got=${JSON.stringify(got)}`);
      }
    }
    if (mismatches.length) throw new Error(`${mismatches.length}/${(golden as any[]).length} mismatch:\n` + mismatches.slice(0,5).join("\n"));
    expect(mismatches.length).toBe(0);
  });
});
