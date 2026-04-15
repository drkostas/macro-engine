-- Minimal seed for CI e2e tests. Fills the tables the dashboard requires on
-- first render (so /dashboard doesn't redirect to onboarding) with dummy data
-- that is not personal to any real user.
--
-- Applied AFTER seed.sql in the CI pipeline.

INSERT INTO nutrition_profile (
  id, weight_kg, height_cm, age, sex, activity_level, goal,
  target_calories, target_protein, target_carbs, target_fat, target_fiber,
  estimated_bf_pct, estimated_ffm_kg, target_bf_pct, tdee_estimate, tdee_confidence,
  daily_deficit, protein_g_per_kg, fat_g_per_kg, step_goal
) VALUES (
  1, 75.0, 180, 30, 'male', 'moderate', 'lose',
  1800, 165, 180, 50, 28,
  15, 63, 12, 2600, 'medium',
  800, 2.2, 0.8, 10000
) ON CONFLICT (id) DO NOTHING;

-- One weigh-in so weight trends + hero have data.
INSERT INTO weight_log (date, weight_grams, source_type, recorded_at)
VALUES (CURRENT_DATE, 75000, 'manual', NOW())
ON CONFLICT (date, weight_grams) DO NOTHING;

-- Banister defaults so training overlays don't crash.
INSERT INTO banister_params (id, k1, k2, tau1, tau2, baseline_fitness, baseline_fatigue)
VALUES (1, 1.0, 2.0, 42, 7, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Today's nutrition_day exists so meal log FK references don't fail.
INSERT INTO nutrition_day (date, status, training_day_type, target_calories, target_protein, target_carbs, target_fat, target_fiber, tdee_used, deficit_used, expected_steps)
VALUES (CURRENT_DATE, 'active', 'rest', 1800, 165, 180, 50, 28, 2600, 800, 10000)
ON CONFLICT (date) DO NOTHING;
