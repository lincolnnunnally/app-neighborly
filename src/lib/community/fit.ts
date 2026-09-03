import type { WeekendSlot } from "./weekend";

export type FitPrefs = {
  interests: string[];
  setting_pref: string;
  mobility: string;
};

export type FitResult = {
  score: number;
  label: "good" | "ok" | "stretch";
  why: string;
};

function hay(slot: WeekendSlot): string {
  return `${slot.title} ${slot.location} ${slot.why} ${slot.source}`.toLowerCase();
}

function interestHit(interests: string[], text: string): string[] {
  return interests.filter((i) => {
    const n = i.toLowerCase();
    if (!n) return false;
    if (text.includes(n)) return true;
    if (n.includes("knit") || n.includes("crochet")) return /knit|fiber|yarn|crochet/.test(text);
    if (n.includes("wood") || n.includes("spoon")) return /wood|carve|spoon|shop/.test(text);
    if (n.includes("pickle") || n === "sports") return /pickle/.test(text);
    if (n.includes("tennis")) return /tennis/.test(text);
    if (n.includes("hik") || n.includes("trail")) return /hike|trail|walk/.test(text);
    if (n.includes("canoe") || n.includes("kayak") || n.includes("sail")) return /canoe|kayak|sail|paddle/.test(text);
    if (n.includes("climb")) return /climb|boulder/.test(text);
    if (n.includes("kid") || n.includes("teach")) return /kid|child|family|paw patrol|story/.test(text);
    if (n.includes("faith")) return /church|baptist|recovery|faith/.test(text);
    if (n.includes("movie") || n.includes("karaoke") || n.includes("trivia"))
      return /theatre|theater|movie|pal|karaoke|trivia/.test(text);
    if (n.includes("book")) return /book|library|reading|story/.test(text);
    if (n.includes("wine")) return /wine|tasting/.test(text);
    return false;
  });
}

function looksSeated(slot: WeekendSlot, text: string): boolean {
  return (
    slot.indoor ||
    /library|book|crochet|knit|movie|theatre|theater|class|reading|story|craft|wine/.test(text)
  );
}

function looksHighEnergy(text: string, indoor: boolean): boolean {
  return /hike|trail|climb|canoe|kayak|sail|run|rock/.test(text) && !indoor;
}

function looksActive(text: string): boolean {
  return /pickle|tennis|sport|walk|park|splash|outdoor/.test(text);
}

/**
 * Rank, do not hide. A seated neighbor still sees the park; it just is not first.
 * A canoe person still sees the library. Towns that only have a few listings
 * must keep every real public row visible.
 */
export function scoreFit(slot: WeekendSlot, prefs: FitPrefs | null | undefined): FitResult {
  if (!prefs || (!prefs.interests.length && !prefs.setting_pref && !prefs.mobility)) {
    return { score: 50, label: "ok", why: "" };
  }

  const text = hay(slot);
  const interests = (prefs.interests || []).map((i) => i.toLowerCase());
  const setting = (prefs.setting_pref || "").toLowerCase();
  const pace = (prefs.mobility || "").toLowerCase();
  const hits = interestHit(interests, text);

  let score = 50;
  const notes: string[] = [];

  if (hits.length) {
    score += 20 * Math.min(hits.length, 3);
    notes.push(`Touches ${hits.slice(0, 2).join(", ")}.`);
  }

  if (setting === "indoor" && slot.indoor) {
    score += 10;
    notes.push("Indoor.");
  } else if (setting === "outdoor" && !slot.indoor) {
    score += 10;
    notes.push("Outside.");
  } else if (setting === "indoor" && !slot.indoor) {
    score -= 8;
    notes.push("Outside — listed anyway.");
  } else if (setting === "outdoor" && slot.indoor) {
    score -= 6;
    notes.push("Indoor — listed anyway.");
  }

  const seated = looksSeated(slot, text);
  const high = looksHighEnergy(text, slot.indoor);
  const active = looksActive(text);

  if (pace === "seated") {
    if (seated) {
      score += 18;
      notes.push("You can sit for this.");
    } else if (high) {
      score -= 12;
      notes.push("More movement than a library chair — still here if you want it.");
    }
  } else if (pace === "easy" || pace === "walking") {
    if (seated || active) score += 8;
    if (high) score -= 4;
  } else if (pace === "active") {
    if (active) {
      score += 14;
      notes.push("A chance to move.");
    }
  } else if (pace === "high") {
    if (high) {
      score += 18;
      notes.push("Higher energy.");
    } else if (seated && !hits.length) {
      score -= 6;
    }
  }

  if (interests.some((i) => /kid|child/.test(i)) && slot.withChild) score += 10;

  let label: FitResult["label"] = "ok";
  if (score >= 70) label = "good";
  if (score < 40) label = "stretch";
  return { score, label, why: notes.join(" ").trim() };
}

/** Keep every real listing. Sort closer-to-you first. Never empty a town. */
export function splitByFit<T extends WeekendSlot>(
  slots: T[],
  prefs: FitPrefs | null | undefined,
): { primary: T[]; other: T[] } {
  const ranked = [...slots].sort((a, b) => {
    const sa = scoreFit(a, prefs).score;
    const sb = scoreFit(b, prefs).score;
    if (sb !== sa) return sb - sa;
    return a.starts_at.localeCompare(b.starts_at);
  });
  return { primary: ranked, other: [] };
}
