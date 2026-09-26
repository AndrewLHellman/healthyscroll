import type { Category } from "@healthyscroll/shared";

/**
 * One fixed colour per category, shared by the landing's week chart and the
 * dashboard, so gambling is the same amber everywhere. Soft pastels that still
 * read as solid bars on white; grey is reserved for "everything else".
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  comedy: "#f5c86a",
  food: "#f4a37f",
  fitness_body: "#8cd3b4",
  beauty_fashion: "#f5b3d2",
  music_dance: "#c7b9f0",
  gaming: "#8db7f0",
  learn: "#7fc9d8",
  animals: "#c8d478",
  drama: "#ee8f9d",
  politics_outrage: "#cf93c9",
  money_hustle: "#a6d08b",
  gambling: "#e8b060",
  drinking_nightlife: "#8f80d8",
  other: "#d5d8de",
};

/** Categories that were collapsed out of the legend. */
export const REST_COLOR = "#e6e8ec";

export function categoryColor(cat: Category): string {
  return CATEGORY_COLORS[cat];
}
