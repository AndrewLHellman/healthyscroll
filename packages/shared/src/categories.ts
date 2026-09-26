/**
 * Fixed taxonomy for the "what did I spend time on" tally.
 *
 * Deliberately small and human — a category is a word you'd use to describe a
 * video to a friend, not a moderation label. The descriptions double as the
 * `criteria` for Jev's choice question, so wording here changes classification.
 *
 * Not related to the user's policy: the policy decides what gets skipped, the
 * category just says what it was.
 */
export const CATEGORIES = {
  comedy: "Sketches, memes, pranks, reaction humour. Made to be funny.",
  food: "Cooking, recipes, restaurants, eating.",
  fitness_body: "Workouts, gym, physique, transformations, body comparison.",
  beauty_fashion: "Makeup, skincare, outfits, hauls, grooming.",
  music_dance: "Performing, singing, dancing, lip-sync, DJ sets.",
  gaming: "Gameplay, streamers, game commentary.",
  learn: "Explainers, how-to, tutorials, science, history, tips.",
  animals: "Pets and wildlife.",
  drama: "Storytimes, relationship content, breakups, gossip, tea.",
  politics_outrage: "Political commentary, debate clips, rage-bait, dunking on people.",
  money_hustle: "Crypto, trading, get-rich-quick, hustle and grind culture.",
  gambling: "Slots, casino, sports betting, wins and losses.",
  drinking_nightlife: "Alcohol, partying, clubs, bars, drinking games.",
  other: "None of the above fits.",
} as const;

export type Category = keyof typeof CATEGORIES;

export const CATEGORY_LABELS: Record<Category, string> = {
  comedy: "comedy",
  food: "food",
  fitness_body: "fitness & body",
  beauty_fashion: "beauty & fashion",
  music_dance: "music & dance",
  gaming: "gaming",
  learn: "learning",
  animals: "animals",
  drama: "relationships & drama",
  politics_outrage: "politics & outrage",
  money_hustle: "money & hustle",
  gambling: "gambling",
  drinking_nightlife: "drinking & nightlife",
  other: "other",
};

export function isCategory(v: string): v is Category {
  return v in CATEGORIES;
}
