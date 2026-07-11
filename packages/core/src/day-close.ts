/**
 * Day-close recompute — ported from soma close_yesterday.py::compute_actual_target.
 * (The close_yesterday(conn) DB orchestration stays in the sync layer.)
 */
import { pyRound } from "./deficit";

export const KCAL_PER_STEP_PER_KG = 0.000423;

/** Recompute (targetCalories, tdeeUsed) from day-end actuals — strips predicted
 *  run/gym kcal baked into the in-day target when those activities never happened. */
export function computeActualTarget(opts: {
  bmr: number;
  actualSteps: number;
  weightKg: number;
  actualRunCal: number;
  actualGymCal: number;
  deficitUsed: number;
}): { target: number; tdee: number } {
  const { bmr, actualSteps, weightKg, actualRunCal, actualGymCal, deficitUsed } = opts;
  const actualStepCal = pyRound(actualSteps * KCAL_PER_STEP_PER_KG * weightKg);
  const actualTotalBurn = pyRound(bmr + actualStepCal + actualRunCal + actualGymCal);
  const newTarget = pyRound(actualTotalBurn - deficitUsed);
  return { target: newTarget, tdee: actualTotalBurn };
}
