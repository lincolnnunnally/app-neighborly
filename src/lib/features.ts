import type { Faq } from "./seo";

/**
 * One public page per thing a neighbor can do on Neighborly that had no page
 * of its own (the weekend planner, ministry, churches, search and town lookup
 * already do). Each entry is checked against the code it describes, noted per
 * entry. Boards may be empty: describe what people can do, never imply
 * activity. If the code changes, change the copy.
 */
export type BoardTab = "needs" | "services" | "tools" | "places";

export type Feature = {
  path: string;
  /** Short label for footer and related links. */
  label: string;
  /** <title>: ~50-60 chars, service + brand. */
  title: string;
  /** Meta description: ~140-160 chars. */
  description: string;
  serviceType: string;
  /** Only where the listings are actually local. */
  areaServed?: string[];
  h1: string;
  intro: string;
  sections: { h2: string; body: string[] }[];
  /** Where the feature lives on a town board. */
  tab: BoardTab;
  cat?: string;
  cta: string;
  faqs: Faq[];
};

const ACCOUNT_FAQ: Faq = {
  q: "Do I need an account?",
  a: "Browsing a town board is free and needs no account. Make a free account when you want to post, offer, borrow or send a request.",
};

export const FEATURES: Feature[] = [
  // src/routes/app/needs.tsx (post need, offerHelp, acceptHelpOffer), src/routes/how-it-works.tsx step 5
  {
    path: "/ask-neighbors-for-help",
    label: "Ask for a hand",
    title: "Ask Neighbors for a Hand: Rides, Repairs, Meals | Neighborly",
    description:
      "Post what you need on your town's Neighborly board, from a ride to the pharmacy to help hanging a ceiling fan. Neighbors who can help offer, and you accept.",
    serviceType: "Neighbor help requests",
    h1: "Ask your neighbors for a hand",
    intro:
      "A ride to the pharmacy, help moving a couch, a casserole after surgery. Post it on your town's board and neighbors who can help can offer.",
    sections: [
      {
        h2: "How asking works",
        body: [
          "Say what you need and add the details that matter: timing, tools needed, accessibility notes.",
          "Neighbors who open your request can offer to help with a short message. You see the offers and accept the one that fits. Offering help marks a need as matched so nothing falls through the cracks.",
        ],
      },
      {
        h2: "Help when you can",
        body: [
          "The same board shows open requests from people near you. If you can help, open the card and offer.",
          "If no one in your town has posted yet, the board says so. Your request can be the first.",
        ],
      },
      {
        h2: "Safety",
        body: [
          "Meet in public places. Neighborly has Report and Block. In a crisis, call or text 988.",
        ],
      },
    ],
    tab: "needs",
    cta: "Post a need",
    faqs: [
      ACCOUNT_FAQ,
      {
        q: "What kinds of things can I ask for?",
        a: "Everyday help from lightbulbs to home projects: a ride, a hand moving something, a meal, a repair.",
      },
    ],
  },
  // src/routes/app/services.tsx (title, pricing model, is_youth, photo, portfolio link, messages)
  {
    path: "/local-services",
    label: "Local services",
    title: "Find Local Services and Offer Your Skills | Neighborly",
    description:
      "Find neighbors offering lawn mowing, handyman work, tutoring and handmade goods in your town, or list your own service at your own price. Youth services are labeled.",
    serviceType: "Local services directory",
    h1: "Find local services, or offer your own",
    intro:
      "Yard work, tutoring, woodworking. Neighbors list what they are good at on their town's board, so you can find help from someone nearby.",
    sections: [
      {
        h2: "What a service listing shows",
        body: [
          "A title and description of what is offered and when, the provider's own pricing (for example an hourly rate, free estimates, or trades), and optionally a photo and a link to a shop or portfolio.",
          "Maker and artisan work is welcome alongside everyday services.",
        ],
      },
      {
        h2: "Youth services are labeled",
        body: [
          "Young people offering services can mark the listing as a youth service, so parents know before they reach out.",
        ],
      },
      {
        h2: "Getting in touch",
        body: [
          "Neighbors message providers through Neighborly, and providers see messages about their listings in one place.",
        ],
      },
    ],
    tab: "services",
    cta: "See local services",
    faqs: [
      ACCOUNT_FAQ,
      {
        q: "Does Neighborly set prices or take a cut of services?",
        a: "No. Each provider writes their own pricing on the listing, and you arrange the work with them directly.",
      },
    ],
  },
  // src/routes/app/tools.tsx (daily rate, replacement value deposit, pickup hint, borrow requests, return/damage), payments banner
  {
    path: "/borrow-tools",
    label: "Borrow or lend tools",
    title: "Borrow or Lend Tools With Your Neighbors | Neighborly",
    description:
      "Borrow a mower, trailer or pressure washer from a neighbor for a few days, or list your own tool with a daily rate and deposit. Pick up nearby, return when done.",
    serviceType: "Neighbor tool lending",
    h1: "Borrow or lend tools with your neighbors",
    intro:
      "Most tools sit in a garage most of the year. Neighborly lets you list a physical tool for neighbors to borrow for a few days, or find one near you.",
    sections: [
      {
        h2: "Listing a tool",
        body: [
          "Describe the tool, what it does well, fuel and pickup notes. Set a daily rate and a replacement value that serves as the deposit, and give a pickup area hint. No full address is required.",
          "You can pause a listing and relist it whenever you like.",
        ],
      },
      {
        h2: "Borrowing a tool",
        body: [
          "Pick your dates and send a borrow request with any notes: pickup time, return spot, a gas can. The owner sees the request and you arrange the handoff.",
          "When the tool comes back, both sides confirm the return. If something went wrong, such as damage or a late or missing tool, either side can note it on the booking for review.",
        ],
      },
      {
        h2: "Payments",
        body: [
          "Online payment for tool borrowing is not live yet. Bookings are reserved in the app and you settle up when you meet.",
        ],
      },
    ],
    tab: "tools",
    cta: "See tools to borrow",
    faqs: [
      ACCOUNT_FAQ,
      {
        q: "Can I pay online?",
        a: "Not yet. Bookings are reserved in Neighborly and payment is arranged when you meet.",
      },
    ],
  },
  // src/lib/community/toombs-pantries.ts, src/lib/community/pantry.ts, src/routes/app/places.tsx, README "Pantry listings & provenance"
  {
    path: "/food-pantries",
    label: "Food pantries",
    title: "Food Pantries in Vidalia and Toombs County, GA | Neighborly",
    description:
      "Food pantry listings for Vidalia and Toombs County, Georgia: days, hours where sources agree, residency and ID notes, and a link to the source. Call ahead first.",
    serviceType: "Food pantry directory",
    areaServed: ["Vidalia, Georgia", "Toombs County, Georgia"],
    h1: "Food pantries in Vidalia and Toombs County, Georgia",
    intro:
      "The Vidalia board lists food pantries in Vidalia and around Toombs County, with what to know before you go. Other towns' boards list the pantries their neighbors have added.",
    sections: [
      {
        h2: "Where the listings come from",
        body: [
          "The Toombs County listings are transcribed from public sources, chiefly the Southeast Health District's Toombs County Community Resource Guide. Hours are published only where two independent sources agree, and an address is left off where sources disagree.",
          "Until someone confirms a listing it is marked Unconfirmed, with a reminder to call ahead and a link to the source. Listings can also link the pantry's Facebook page, which is often where a closure or a changed day is announced first.",
        ],
      },
      {
        h2: "What each listing can tell you",
        body: [
          "Distribution days and hours, residency or ZIP limits, how often you can visit, what ID or documents to bring, and other notes such as bringing bags.",
          "You can search the list by town, day, or words like “no ID needed”.",
        ],
      },
      {
        h2: "Run a pantry, or know one?",
        body: [
          "Members can add a pantry, or claim an existing listing and keep it current. Claiming makes you the listing's owner.",
        ],
      },
    ],
    tab: "places",
    cat: "pantry",
    cta: "See food pantries",
    faqs: [
      {
        q: "Are the hours guaranteed?",
        a: "No. Hours are shown only where sources agree, and unconfirmed listings say so. Call ahead before you go.",
      },
      {
        q: "Is there a listing for my town outside Toombs County?",
        a: "Other towns' boards show the pantries neighbors have added there. If your town has none yet, you can add one.",
      },
    ],
  },
  // src/routes/app/places.tsx (requestFacility: date, time, purpose; status "requested"), facilities rate_note
  {
    path: "/reserve-a-pavilion",
    label: "Reserve a place",
    title: "Reserve a Pavilion or Community Room | Neighborly",
    description:
      "Request a pavilion, community room or other reservable place listed on your town's Neighborly board for a birthday, reunion or meeting. Rates set by each place.",
    serviceType: "Community space reservation requests",
    h1: "Reserve a pavilion or community room",
    intro:
      "Need a pavilion for a kid's birthday or a room for a family reunion? Town boards list reservable places, and you can send a request from Neighborly.",
    sections: [
      {
        h2: "How a request works",
        body: [
          "Open a reservable place on your town's board, pick a date and time, and say what it's for. Your request shows as requested until it is confirmed.",
          "Each place shows its capacity, amenities and a note on rates. Confirm availability and any fees with the place itself.",
        ],
      },
      {
        h2: "If your town has none listed",
        body: ["Some boards have no reservable places yet, and the board says so."],
      },
    ],
    tab: "places",
    cta: "See reservable places",
    faqs: [
      ACCOUNT_FAQ,
      {
        q: "Is my reservation confirmed when I send it?",
        a: "No. It is a request. It shows as requested until it is confirmed, and the place sets its own rates and rules.",
      },
    ],
  },
];

/** Public pages that already cover the rest of what Neighborly does. */
export const EXISTING_FEATURE_LINKS: { to: string; label: string }[] = [
  { to: "/weekend", label: "This weekend" },
  { to: "/ministry", label: "Bible studies & ways to serve" },
  { to: "/churches", label: "Churches near you" },
  { to: "/search", label: "Search everything" },
  { to: "/near", label: "Find your town" },
];

export function featureByPath(path: string): Feature {
  const f = FEATURES.find((x) => x.path === path);
  if (!f) throw new Error(`Unknown feature page ${path}`);
  return f;
}
