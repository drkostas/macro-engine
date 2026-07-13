/** Standard drink database — ported from soma seed_data.py::DRINK_DATABASE. */
export interface Drink { name: string; calories_per_100ml: number; carbs_per_100ml: number; alcohol_pct: number; default_ml: number; }
export const DRINK_DATABASE: Record<string, Drink> = {
  "beer_light": {
    "name": "Light Beer",
    "calories_per_100ml": 29,
    "carbs_per_100ml": 1.3,
    "alcohol_pct": 4.2,
    "default_ml": 355
  },
  "beer_regular": {
    "name": "Regular Beer",
    "calories_per_100ml": 43,
    "carbs_per_100ml": 3.6,
    "alcohol_pct": 5.0,
    "default_ml": 355
  },
  "beer_ipa": {
    "name": "IPA",
    "calories_per_100ml": 60,
    "carbs_per_100ml": 4.0,
    "alcohol_pct": 6.5,
    "default_ml": 355
  },
  "beer_craft": {
    "name": "Craft Beer",
    "calories_per_100ml": 73.2,
    "carbs_per_100ml": 5.0,
    "alcohol_pct": 7.8,
    "default_ml": 355
  },
  "wine_red": {
    "name": "Red Wine",
    "calories_per_100ml": 85,
    "carbs_per_100ml": 2.6,
    "alcohol_pct": 13.5,
    "default_ml": 150
  },
  "wine_white": {
    "name": "White Wine",
    "calories_per_100ml": 82,
    "carbs_per_100ml": 2.6,
    "alcohol_pct": 12.5,
    "default_ml": 150
  },
  "spirit": {
    "name": "Spirit (neat/rocks)",
    "calories_per_100ml": 220.5,
    "carbs_per_100ml": 0,
    "alcohol_pct": 40.0,
    "default_ml": 44
  },
  "margarita": {
    "name": "Margarita",
    "calories_per_100ml": 110,
    "carbs_per_100ml": 11.0,
    "alcohol_pct": 13.0,
    "default_ml": 240
  },
  "old_fashioned": {
    "name": "Old Fashioned",
    "calories_per_100ml": 140,
    "carbs_per_100ml": 5.0,
    "alcohol_pct": 20.0,
    "default_ml": 120
  }
};
