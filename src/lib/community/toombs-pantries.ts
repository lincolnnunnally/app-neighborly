/**
 * Toombs County, Georgia food pantry listings.
 *
 * WHY THESE ARE HERE AT ALL
 * A neighbor searching "food pantry" on the Vidalia board found nothing, because
 * the directory only ever held pantries a neighbor had personally added. These
 * rows publish what real, citable public sources say exists in Toombs County
 * (Vidalia, Lyons) so the search has something honest to return.
 *
 * WHAT THESE ARE NOT
 * They are NOT verified by us. Every row below is transcribed from a public
 * source that we could read but could not independently confirm, so each ships
 * as a `Public listing` with `verified_on` empty — the UI renders that as
 * "Unconfirmed" with a call-ahead line and a link to the source. Any member can
 * claim a row and correct it (see updatePantryListing), which is the intended
 * path from "a directory says this" to "a neighbor stands behind this".
 *
 * THE RULES THIS FILE FOLLOWS (DC-1, applied to third-party data)
 * 1. No field is written unless a named source states it. Unknown stays empty —
 *    the UI already prints "Not listed" and "confirm before you go".
 * 2. `serve_days` / `serve_times` are populated ONLY when two independent
 *    sources agree. Hours are the field that sends someone on a wasted trip.
 *    A single-source or conflicting hour goes in `other_notes` as a REPORTED
 *    hour, never in the hours field.
 * 3. When sources disagree on an ADDRESS, publish no address at all — only the
 *    phone, plus both candidates in the notes. Driving a hungry family to the
 *    wrong building is the worst thing this file could do.
 *    The ONE exception is a conflict that a newer, first-party, dated source
 *    actually settles — the organization's own filing or announcement, with
 *    corroboration. Then publish the current address and use the notes to
 *    explain the stale one, so a neighbor who checked an old directory is not
 *    left wondering which of the two to believe. God's Store House is the
 *    worked example: its own accounts date the move, and the local paper
 *    reported it, against a directory line nobody refreshed.
 * 4. Organizations outside Toombs County are excluded no matter how often they
 *    surface under a "Vidalia GA" search (Mount Vernon / Ailey are Montgomery
 *    County; Glennville and Reidsville are Tattnall; Soperton is Treutlen).
 * 5. Programs with no fixed address (Second Harvest's Toombs mobile pantry,
 *    Bread of Heaven's rotating drive-through) are deliberately NOT listed as
 *    places. A place row implies "go here", which is false for those. They
 *    belong on the events board when a date and site are known.
 *
 * PRIMARY SOURCE
 * Southeast Health District (Georgia Department of Public Health) —
 * "Toombs County Community Resource Guide", dated 17 Sep 2025, section
 * "Food Banks". A county-scoped, dated, government-published list.
 */

export type PublicPantryListing = {
  /** Stable row id — changing it would orphan a neighbor's claim. */
  id: string;
  /** Board this belongs to. Toombs County listings live on the Vidalia board. */
  communityId: string;
  name: string;
  /** Empty when sources disagree — see rule 3. */
  address: string;
  city: string;
  zip: string;
  serve_days: string;
  serve_times: string;
  residency_note: string;
  visit_frequency: string;
  id_docs: string;
  other_notes: string;
  phone: string;
  /** The organization's own site, when it has one. Not the source. */
  website: string;
  /** Its Facebook page — for most of these, the only live channel they have. */
  facebook_url: string;
  description: string;
  /** Where these facts were read. Shown, and linked, on the card. */
  source_name: string;
  source_url: string;
  /** YYYY-MM-DD a local person last checked. Empty = unconfirmed directory row. */
  verified_on?: string;
  /** True when a visit found the pantry gone. Still listed so search does not send people there. */
  closed?: boolean;
};

const SEHD_GUIDE_NAME =
  "Toombs County Community Resource Guide (Southeast Health District, 17 Sep 2025)";
const SEHD_GUIDE_URL =
  "https://www.sehdph.org/wp-content/uploads/2025/09/Toombs-County-Community-Resource-09-17-25.pdf";

const CONFIRM = "Unconfirmed listing — nobody local has claimed it yet.";

export const TOOMBS_PANTRY_LISTINGS: PublicPantryListing[] = [
  // ── Vidalia ───────────────────────────────────────────────────────────────
  {
    id: "pantry_pub_concerted_services",
    communityId: "comm_vidalia",
    name: "Concerted Services — Toombs County Service Center",
    address: "107 Old Airport Rd",
    city: "Vidalia",
    zip: "30474",
    // Two aggregators report Mon–Fri 8:00am–4:30pm, but that reads as the
    // service center's OFFICE hours, not a pantry window. Rule 2: notes, not hours.
    serve_days: "",
    serve_times: "",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "Community action agency service center — the agency now trades as Action Pact — offering emergency and energy assistance alongside food. Directories report office hours of Monday–Friday 8:00am–4:30pm and advise calling before you go: that is the office, not a confirmed pantry window. Action Pact also runs an automated appointment line on 912-788-5151, and a second number, 912-285-6083, appears in food directories. " +
      CONFIRM,
    phone: "912-537-0453",
    website: "https://myactionpact.org/",
    facebook_url: "",
    description:
      "Listed under Food Banks for Toombs County in the county's public health resource guide.",
    source_name: SEHD_GUIDE_NAME,
    source_url: SEHD_GUIDE_URL,
  },
  {
    id: "pantry_pub_gods_storehouse",
    communityId: "comm_vidalia",
    // The address dispute is settled. The county guide still prints the old
    // 300 McIntosh St, but the ministry's own filed accounts state the lease
    // there ended 8/31/22 and it moved to 2200 Center Drive on 9/1/22, which
    // The Advance News reported at the time. Newer, first-party and dated
    // beats a directory line that was never refreshed.
    name: "God's Store House",
    address: "2200 Center Drive",
    city: "Vidalia",
    zip: "30474",
    serve_days: "Not operating at this address",
    serve_times: "",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "CLOSED — visited in person 10 Sep 2026. The building at 2200 Center Drive is empty and for sale. Either out of business or moved. Do not go here expecting food. Directories still print a 2022 move from 300 McIntosh St; that address is also stale.",
    phone: "912-538-1730",
    website: "",
    facebook_url: "https://www.facebook.com/Gods-Storehouse-The-Jesus-Inn-678439662239874/",
    description:
      "Was a food and clothing ministry. As of 10 Sep 2026 the building is empty and for sale.",
    source_name: "Visited in person 10 Sep 2026",
    source_url: "https://plenty.unitedundergod.org/around",
    verified_on: "2026-09-10",
    closed: true,
  },
  {
    id: "pantry_pub_solomon_tabernacle",
    communityId: "comm_vidalia",
    name: "Solomon Tabernacle Baptist Church",
    address: "902 Thompson St",
    city: "Vidalia",
    zip: "30474",
    serve_days: "",
    serve_times: "",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "Church food ministry. No days or hours are published anywhere we can cite — call the church office first. " +
      CONFIRM,
    phone: "912-537-1350",
    website: "",
    facebook_url: "https://www.facebook.com/solomontabernaclemissionarybaptistchurch/",
    description:
      "Listed under Food Banks for Toombs County in the county's public health resource guide. Also listed as Solomon Tabernacle Missionary Baptist Church.",
    source_name: SEHD_GUIDE_NAME,
    source_url: SEHD_GUIDE_URL,
  },
  {
    id: "pantry_pub_vidalia_church_of_god",
    communityId: "comm_vidalia",
    name: "Vidalia Church of God",
    address: "401 Adams St",
    city: "Vidalia",
    zip: "30474",
    serve_days: "Third Wednesday of the month",
    serve_times: "Starts serving about 4:00 p.m.",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "Hours confirmed in person 10 Sep 2026: one Wednesday a month — the third Wednesday — they start serving about 4 o'clock. Address and phone from the church listing; hours from the visit.",
    phone: "912-537-4361",
    website: "https://vidaliachurch.org/",
    facebook_url: "https://www.facebook.com/vidaliachurch.org/",
    description: "Church food pantry. Third Wednesday of the month, starting about 4:00 p.m.",
    source_name: "Visited in person 10 Sep 2026",
    source_url: "https://plenty.unitedundergod.org/around",
    verified_on: "2026-09-10",
  },
  {
    id: "pantry_pub_boys_girls_club",
    communityId: "comm_vidalia",
    name: "Boys & Girls Club of Toombs County",
    address: "800 3rd St",
    city: "Vidalia",
    zip: "30474",
    serve_days: "",
    serve_times: "",
    residency_note:
      "Serves club youth and their families — this is not a general household pantry. Call to ask who is eligible.",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "Appears under Food Banks in the county resource guide, but the organization's main work is youth programming, so food help here is likely tied to the children it serves. There are clubs in both Vidalia and Lyons. A second Facebook page, \"BGC of Toombs County\", also exists and may be the newer one. " +
      CONFIRM,
    phone: "912-538-8899",
    // Two Facebook pages surface for this club. This is the one whose name
    // matches the Toombs County club exactly; a second page, "BGC of Toombs
    // County", also exists and may be the newer one — the note says so, since
    // a possibly-stale Facebook link is a far smaller risk than a wrong address.
    website: "",
    facebook_url: "https://www.facebook.com/bgctc3260/",
    description:
      "Youth organization with clubs in Vidalia and Lyons, listed under Food Banks for Toombs County.",
    source_name: SEHD_GUIDE_NAME,
    source_url: SEHD_GUIDE_URL,
  },

  // ── Lyons ─────────────────────────────────────────────────────────────────
  {
    id: "pantry_pub_his_works",
    communityId: "comm_vidalia",
    name: "His Works Ministry Outreach & Food Bank",
    address: "120 East Liberty Ave",
    city: "Lyons",
    zip: "30436",
    // Rule 2 satisfied: the same hours appear in the food directory, the
    // Greater Vidalia Chamber member listing, and the ministry's own page.
    serve_days: "Monday, Tuesday and Wednesday",
    serve_times: "10:00am – 1:00pm",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "These hours are the best-corroborated of any pantry on this board — a food directory, the Greater Vidalia Chamber listing, and the ministry's own page all give the same window. A second number, 912-388-8043, appears in food directories and on the ministry's own Facebook page — try that one if the first does not answer. " +
      CONFIRM,
    phone: "912-245-6485",
    website: "",
    facebook_url: "https://www.facebook.com/Hisworks30436/",
    description:
      "Independent food bank ministry in Lyons, registered as a nonprofit since 2018. Food, clothing and other essentials.",
    source_name: "Greater Vidalia Chamber member directory + food pantry directories",
    source_url: "https://members.greatervidaliachamber.com/Food-Bank/His-Works-Ministry-2255",
  },
  {
    id: "pantry_pub_segcp",
    communityId: "comm_vidalia",
    name: "Southeast Georgia Communities Project",
    address: "300 S State St",
    city: "Lyons",
    zip: "30436",
    serve_days: "Monday to Wednesday (Thursday and Friday by appointment)",
    serve_times: "9:00am – 12:00pm",
    residency_note:
      "Works primarily with farmworker and immigrant families in the area, but ask — do not rule yourself out.",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "The food pantry is one of several support services this nonprofit runs. Spanish is spoken. A second number, 912-526-0065, is also listed. Hours as reported by the county resource guide and a food directory. " +
      CONFIRM,
    phone: "912-526-5451",
    website: "https://www.segcp.org/",
    facebook_url: "",
    description:
      "Nonprofit serving migrant and seasonal farmworker families — food, clothing, interpreting and an immigration clinic. Listed under Food Banks for Toombs County.",
    source_name: SEHD_GUIDE_NAME,
    source_url: SEHD_GUIDE_URL,
  },
  {
    id: "pantry_pub_oasis_church_of_god",
    communityId: "comm_vidalia",
    name: "Oasis Church of God — food distribution",
    address: "1163 US Highway 1 South",
    city: "Lyons",
    zip: "30436",
    serve_days: "Monday and Tuesday; Friday",
    serve_times: "Mon & Tue 3:00pm – 5:00pm · Fri 8:00am – 2:00pm",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "Hours come from two food directories that agree with each other, not from the church itself — call to confirm before you drive out. " +
      CONFIRM,
    phone: "912-526-5060",
    // churchofgod.cc turns up in directories for this entry, but that is the
    // denomination's national site, not this congregation's. Not published.
    website: "",
    facebook_url: "https://www.facebook.com/oasiscog/",
    description: "Church food distribution listed in public food-assistance directories.",
    source_name: "Food pantry directories (Lemontree / FreeFood.org)",
    source_url: "https://www.freefood.org/l/oasis-church-of-god",
  },
  {
    id: "pantry_pub_lyons_free_will_baptist",
    communityId: "comm_vidalia",
    name: "Lyons Free Will Baptist Church food pantry",
    address: "803 Reidsville Highway",
    city: "Lyons",
    zip: "30436",
    // Rule 2 still applies: one directory says 2nd & 4th Friday 1:30–3:30pm,
    // another says Monday 10:00am–12:00pm. Monday is now the more commonly
    // reported of the two, but "more common" is not agreement, so the hours
    // field stays empty and both windows go in the notes.
    serve_days: "",
    serve_times: "",
    residency_note: "",
    visit_frequency: "Reported as one visit per month.",
    id_docs: "Reported: bring a valid ID and proof of address on a first visit.",
    other_notes:
      "HOURS CONFLICT between directories — most list Monday 10:00am–12:00pm, but one lists the 2nd and 4th Friday, 1:30pm–3:30pm. Call the church before you go rather than trusting either. Limited delivery is reported for seniors and people with medical needs — worth asking about. " +
      CONFIRM,
    phone: "912-526-4320",
    website: "",
    facebook_url: "https://www.facebook.com/100070046301620/",
    description: "Church food pantry listed in public food-assistance directories.",
    source_name: "Food pantry directories (Lemontree / FreeFood.org)",
    source_url: "https://www.freefood.org/l/lyons-free-will-baptist-church",
  },
  {
    id: "pantry_pub_toombs_farmers_market",
    communityId: "comm_vidalia",
    name: "Farmer's Market — Toombs County Schools",
    address: "117 E Wesley Ave",
    city: "Lyons",
    zip: "30436",
    serve_days: "",
    serve_times: "",
    residency_note: "",
    visit_frequency: "",
    id_docs: "",
    other_notes:
      "The weakest listing on this board: its only basis is a line under Food Banks in the county resource guide, with nothing else describing how or when it distributes food. Note that 117 E Wesley Ave is the school district's central office, so this is a number to call rather than a place to turn up at. Do not confuse it with the commercial Toombs County Farmers Market, which is a different operation elsewhere in Lyons. " +
      CONFIRM,
    phone: "912-526-3161",
    website: "",
    facebook_url: "",
    description: "Listed under Food Banks for Toombs County in the county resource guide.",
    source_name: SEHD_GUIDE_NAME,
    source_url: SEHD_GUIDE_URL,
  },
];

/**
 * Sourced programs deliberately NOT published as pantry rows, kept here so the
 * next person does not have to re-derive why they are missing:
 *
 * - Second Harvest of Coastal Georgia "Mobile Food Pantry — Toombs County":
 *   real and recurring, but the event pages that surfaced are from 2024 and no
 *   current date or host site could be established. A mobile pantry has no
 *   address to send anyone to; it belongs on the events board when scheduled.
 * - Bread of Heaven Outreach (Vidalia): a rotating drive-through distribution.
 *   Same reason — any fixed address would be wrong.
 * - The Salvation Army, Vidalia: a service center exists, but no source states
 *   it runs a food pantry.
 * - Toombs County schools' Summer Food Service Program: seasonal, and the 2026
 *   season ended in July. Listing it now would read as open.
 * - Toombs County DFCS, United Way of Toombs/Montgomery/Wheeler, Toombs County
 *   Family Connection, Vidalia Housing Authority: referral or funding bodies,
 *   not places to get food.
 * - Community food distribution at Mount Vernon: Montgomery County, not Toombs.
 */
