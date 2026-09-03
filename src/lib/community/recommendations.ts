import type { Profile } from "./types";

export type NextStep = {
  title: string;
  why: string;
  href: string;
  kind: "community" | "app";
};

const PICKLE = ["pickleball", "tennis", "sports"];
const MAKERS = ["woodworking", "welding", "blacksmithing", "spoon carving", "makers"];
const OUTDOORS = ["nature", "mushrooming", "hiking", "outdoors"];

export function suggestedCommunitySlugs(input: {
  life_season?: string;
  interests?: string[];
}): string[] {
  const slugs = new Set<string>(["vidalia"]);
  const season = input.life_season || "";
  const interests = (input.interests || []).map((i) => i.toLowerCase());
  if (season === "divorced_dad") slugs.add("vidalia-dads");
  if (interests.some((i) => PICKLE.includes(i) || i.includes("pickle"))) slugs.add("vidalia-pickleball");
  if (interests.some((i) => MAKERS.some((m) => i.includes(m)))) slugs.add("vidalia-makers");
  if (interests.some((i) => OUTDOORS.some((m) => i.includes(m)))) slugs.add("vidalia-outdoors");
  return [...slugs];
}

/** Honest next steps. Never auto-opens dating. Never invents people. */
export function recommendNextSteps(profile: Partial<Profile>): NextStep[] {
  const steps: NextStep[] = [];
  const season = profile.life_season || "";
  const faith = profile.faith_posture || "";
  const hope = (profile.hoping_for || "").toLowerCase();
  const interests = (profile.interests || []).map((i) => i.toLowerCase());
  const lonely = /lonely|alone|isolated|belong/.test(hope);

  steps.push({
    kind: "app",
    title: "This weekend in Vidalia",
    why: "Weather, Pal Theatre, parks, and a calendar file — with your daughter or on your own.",
    href: "/weekend",
  });
  steps.push({
    kind: "community",
    title: "Vidalia neighbor board",
    why: "Your home base: events, needs, and people who actually live here. The board is a doorway — the win is sitting with someone.",
    href: "/c/vidalia",
  });
  steps.push({
    kind: "app",
    title: "Presence — a real moment",
    why: "Coffee, a walk, a meal. One yes with a real person beats another hour in an app.",
    href: "https://presence.unitedundergod.org",
  });

  if (season === "divorced_dad") {
    steps.push({
      kind: "community",
      title: "Vidalia dads circle",
      why: "Dads who still matter to their kids — coffee, pickleball, truth-telling.",
      href: "/c/vidalia-dads",
    });
    steps.push({
      kind: "app",
      title: "Kids Need Dads",
      why: "A place to be accepted and become the dad your kids still have. Use the same email when you are ready — we do not invent a second login for you.",
      href: "https://dads.unitedundergod.org",
    });
  }

  if (season === "divorced_mom") {
    steps.push({
      kind: "app",
      title: "ChildFirst",
      why: "Keep children first while the family is in transition.",
      href: "https://childfirst.unitedundergod.org",
    });
  }

  if (season === "single" || lonely || season === "divorced_dad" || season === "divorced_mom") {
    steps.push({
      kind: "app",
      title: "Kindred — friendship first",
      why: "Belonging before romance. Groups stay majority-encouraging so one heavy week cannot pull the circle down.",
      href: "https://kindred.unitedundergod.org",
    });
  }

  if (season === "single" && !lonely) {
    steps.push({
      kind: "app",
      title: "Aligned Souls (optional, later)",
      why: "A separate door for a companion — not a fix for loneliness. Become first. We will not create this account for you.",
      href: "https://alignedsouls.unitedundergod.org",
    });
  }

  if (season === "married" || season === "dating") {
    steps.push({
      kind: "app",
      title: "Live On Mission",
      why: "Serve together. Purpose is discovered by showing up for someone else.",
      href: "https://liveonmission.unitedundergod.org",
    });
  }

  if (["searching", "questioning", "unsure"].includes(faith) || lonely) {
    steps.push({
      kind: "app",
      title: "Spark of Hope",
      why: "Be heard first. Hope comes after belonging, not as a slogan.",
      href: "https://spark.unitedundergod.org",
    });
    steps.push({
      kind: "app",
      title: "Presence Moments",
      why: "A small coffee, walk, or game with a real host.",
      href: "https://presence.unitedundergod.org",
    });
  }

  if (["rooted", "attending"].includes(faith)) {
    steps.push({
      kind: "app",
      title: "ChurchConnect",
      why: "If a church here is on the platform, that is where serving and groups get handled.",
      href: "https://churchconnect.unitedundergod.org",
    });
  }

  if (interests.some((i) => PICKLE.includes(i) || i.includes("pickle"))) {
    steps.push({
      kind: "community",
      title: "Vidalia pickleball",
      why: "Play first, talk second. Rec Complex and First Baptist gym.",
      href: "/c/vidalia-pickleball",
    });
  }

  if (interests.some((i) => MAKERS.some((m) => i.includes(m)))) {
    steps.push({
      kind: "community",
      title: "Vidalia makers",
      why: "Wood, metal, spoons, shops — empty until real makers join.",
      href: "/c/vidalia-makers",
    });
  }

  if (interests.some((i) => OUTDOORS.some((m) => i.includes(m)))) {
    steps.push({
      kind: "community",
      title: "Vidalia outdoors",
      why: "Nature, trails, mushrooms, time off screens.",
      href: "/c/vidalia-outdoors",
    });
  }

  if (/serv|help|volunteer|impact|give/.test(hope) || interests.includes("community cleanups")) {
    steps.push({
      kind: "app",
      title: "Live On Mission",
      why: "Volunteer needs from churches, schools, and neighbors live here too.",
      href: "https://liveonmission.unitedundergod.org",
    });
  }

  // Dedupe by href, keep order.
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (seen.has(s.href)) return false;
    seen.add(s.href);
    return true;
  });
}
