export type DietTag = "vegan" | "vegetarian" | "halal";

export type Dish = {
  /** Vote identity. Derived from the dish name only, so votes follow a dish across days and halls. */
  key: string;
  name: string;
  description?: string;
  tags: DietTag[];
  allergens: string[];
  serving?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  ingredients?: string;
};

export type Zone = {
  /** Station color as labeled on the DC floor plan: Red, Yellow, Blue, Green, Purple, Pink. */
  color: string;
  /** Posted hours for this zone and meal, e.g. "11 AM–5 PM" or "Closed". */
  hours?: string;
  /** Indexes into `MenuData.dishes`. */
  dishes: number[];
};

export type Meal = {
  name: string;
  zones: Zone[];
};

export type Day = {
  /** yyyy-mm-dd in Davis local time. */
  date: string;
  meals: Meal[];
};

export type Hall = {
  id: string;
  name: string;
  url: string;
  days: Day[];
  /** Set when this hall couldn't be scraped. */
  error?: string;
};

export type MenuData = {
  /** ISO timestamp of the scrape. */
  updatedAt: string;
  halls: Hall[];
  /** Deduplicated dish details shared by every hall/day/meal. */
  dishes: Dish[];
};

export type VoteValue = -1 | 0 | 1;

export type VoteTally = { up: number; down: number; mine: VoteValue };
