import type { WeekendSlot } from "./weekend";

export type FitPrefs = {
  interests: string[];
  setting_pref: string;
  mobility: string;
};

export type FitResult = {
  score: number;
  label: "good" | "ok" | "poor";
  why: string;
};

const OUTDOOR = ["hiking", "nature", "mushrooming", "outdoors", "sports", "pickleball", "tennis", "gardening"];
const INDOOR = ["knitting", "fiber arts", "woodworking", "welding", "blacksmithing", "spoon carving", "book club", "movies", "music", "cooking", "indoor games", "faith groups"];
const SEATED = ["knitting", "fiber arts", "book club", "movies", "cooking", "indoor games", "woodworking"];
const KIDS = ["kids activities", "paw patrol", "child", "family"];

function hay(slot: WeekendSlot): string {
  return `${slot.title} ${slot.location} ${slot.why} ${slot.source}`.toLowerCase();
}

function interestHit(interests: string[], text: string): string[] {
  return interests.filter((i) => {
    const n = i.toLowerCase();
    if (!n) return false;
    if (text.includes(n)) return true;
    if (n.includes("knit") && /knit|fiber|yarn|crochet/.test(text)) return true;
    if (n.includes("wood") && /wood|carve|shop/.test(text)) return true;
    if ((n.includes("pickle") || n === "sports") && /pickle/.test(text)) return true;
    if (n.includes("hik") && /hike|trail|walk/.test(text)) return true;
    if (n.includes("kid") && /kid|child|family|paw patrol/.test(text)) return true;
    if (n.includes("faith") && /church|baptist|recovery|faith/.test(text)) return true;
    if (n.includes("movie") && /theatre|theater|movie|pal/.test(text)) return true;
    return false;
  });
}

/** Rank a listing against a real profile. Poor-fit items must not be the primary offer. */
export function scoreFit(slot: WeekendSlot, prefs: FitPrefs | null | undefined): FitResult {
  if (!prefs || (!prefs.interests.length && !prefs.setting_pref && !prefs.mobility)) {
    return { score: 50, label: "ok", why: "" };
  }

  const text = hay(slot);
  const interests = (prefs.interests || []).map((i) => i.toLowerCase());
  const setting = (prefs.setting_pref || "").toLowerCase();
  const mobility = (prefs.mobility || "").toLowerCase();
  const hits = interestHit(interests, text);

  let score = 40;
  let why = "";

  if (hits.length) {
    score += 25 * hits.length;
    why = `Matches ${hits.slice(0, 2).join(", ")}.`;
  }

  if (setting === "indoor" && !slot.indoor) {
    score -= 40;
    why = [why, "You asked for indoor — this is outside."].filter(Boolean).join(" ");
  } else if (setting === "outdoor" && slot.indoor) {
    score -= 15;
    why = [why, "Indoor listing; you prefer being outside."].filter(Boolean).join(" ");
  } else if (setting === "indoor" && slot.indoor) {
    score += 15;
    why = [why, "Indoor, as you asked."].filter(Boolean).join(" ");
  } else if (setting === "outdoor" && !slot.indoor) {
    score += 15;
    why = [why, "Outside, as you asked."].filter(Boolean).join(" ");
  }

  const looksHike = /hike|trail|park|splash|fountain|outdoor pickle/.test(text) && !slot.indoor;
  const looksSeated = slot.indoor || SEATED.some((s) => text.includes(s)) || /theatre|theater|movie|library|class/.test(text);

  if (mobility === "seated") {
    if (looksHike && !looksSeated) {
      score -= 60;
      why = "You asked for seated / indoor-friendly — this is a walking or outdoor slot.";
    } else if (looksSeated) {
      score += 20;
      why = [why, "You can sit for this one."].filter(Boolean).join(" ");
    }
  }

  if (mobility === "walking" && looksHike) {
    score += 15;
  }

  const outdoorInterest = interests.some((i) => OUTDOOR.includes(i));
  const indoorInterest = interests.some((i) => INDOOR.includes(i) || SEATED.includes(i));
  if (outdoorInterest && !slot.indoor) score += 8;
  if (indoorInterest && slot.indoor) score += 8;
  if (interests.some((i) => KIDS.includes(i)) && slot.withChild) score += 12;

  let label: FitResult["label"] = "ok";
  if (score >= 70) label = "good";
  if (score < 25) label = "poor";
  return { score, label, why: why.trim() };
}

export function splitByFit<T extends WeekendSlot>(
  slots: T[],
  prefs: FitPrefs | null | undefined,
): { primary: T[]; other: T[] } {
  if (!prefs || (!prefs.interests.length && !prefs.setting_pref && !prefs.mobility)) {
    return { primary: slots, other: [] };
  }
  const primary: T[] = [];
  const other: T[] = [];
  for (const slot of slots) {
    const fit = scoreFit(slot, prefs);
    if (fit.label === "poor") other.push(slot);
    else primary.push(slot);
  }
  return { primary, other };
}
