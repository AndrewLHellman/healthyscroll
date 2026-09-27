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
  comedy: "Sketches, memes, pranks, reaction humour, funny fails. Made to be funny.",
  food: "Cooking, recipes, restaurants, eating, food reviews.",
  fitness_body: "Workouts, gym, physique, transformations, body comparison.",
  beauty_fashion: "Makeup, skincare, outfits, hauls, grooming, hair.",
  music_dance: "Performing, singing, dancing, lip-sync, DJ sets, concerts.",
  gaming: "Gameplay, streamers, game commentary.",
  sports: "Football, basketball, soccer, baseball, fighting, highlights, athletes, extreme sports, skating, surfing.",
  learn: "Explainers, how-to, tutorials, science, history, facts, life hacks, tips.",
  tech: "Phones, gadgets, computers, AI, coding, apps, product reviews.",
  animals: "Pets and wildlife.",
  travel_outdoors: "Travel, places, scenery, nature, hiking, camping, beaches, cities, hotels.",
  cars: "Cars, motorcycles, trucks, driving, racing, car culture.",
  diy_crafts: "DIY, crafts, art, drawing, woodworking, restoration, home renovation, satisfying process videos.",
  lifestyle: "Day-in-the-life vlogs, family, kids, babies, couples doing everyday things, routines, home life, shopping.",
  drama: "Storytimes, relationship content, breakups, gossip, tea, celebrity news.",
  politics_outrage: "Political commentary, news clips, debate, rage-bait, dunking on people.",
  money_hustle: "Crypto, trading, get-rich-quick, hustle and grind culture, motivational speeches.",
  gambling: "Slots, casino, sports betting, wins and losses.",
  drinking_nightlife: "Alcohol, partying, clubs, bars, drinking games.",
  other: "Genuinely none of the above: pick the closest category first.",
} as const;

export type Category = keyof typeof CATEGORIES;

export const CATEGORY_LABELS: Record<Category, string> = {
  comedy: "comedy",
  food: "food",
  fitness_body: "fitness & body",
  beauty_fashion: "beauty & fashion",
  music_dance: "music & dance",
  gaming: "gaming",
  sports: "sports",
  learn: "learning",
  tech: "tech",
  animals: "animals",
  travel_outdoors: "travel & outdoors",
  cars: "cars",
  diy_crafts: "DIY & crafts",
  lifestyle: "lifestyle & vlogs",
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
