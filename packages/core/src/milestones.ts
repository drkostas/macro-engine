export interface Stats {
  streak: number;
  totalMealsLogged: number;
  daysClosed: number;
  kgLost: number;
}

export interface Milestone {
  id: string;
  label: string;
  test: (s: Stats) => boolean;
}

export const MILESTONES: Milestone[] = [
  { id: "first_meal", label: "First meal logged", test: (s) => s.totalMealsLogged >= 1 },
  { id: "first_close", label: "First day closed", test: (s) => s.daysClosed >= 1 },
  { id: "streak_7", label: "7-day streak", test: (s) => s.streak >= 7 },
  { id: "streak_30", label: "30-day streak", test: (s) => s.streak >= 30 },
  { id: "streak_100", label: "100-day streak", test: (s) => s.streak >= 100 },
  { id: "lost_1kg", label: "1 kg lost", test: (s) => s.kgLost >= 1 },
  { id: "lost_5kg", label: "5 kg lost", test: (s) => s.kgLost >= 5 },
  { id: "meals_100", label: "100 meals logged", test: (s) => s.totalMealsLogged >= 100 },
  { id: "meals_500", label: "500 meals logged", test: (s) => s.totalMealsLogged >= 500 },
];

export function evaluateMilestones(stats: Stats): Milestone[] {
  return MILESTONES.filter((m) => m.test(stats));
}
