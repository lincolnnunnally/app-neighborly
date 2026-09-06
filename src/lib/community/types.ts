export type CommunityKind = "neighborhood" | "church" | "school" | "interest" | "vacation";

export type Community = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  city: string;
  state: string;
  kind: CommunityKind;
  member_count: number;
  cover_color: string;
  is_featured: boolean;
  invite_code: string;
  zip?: string;
  lat?: number | null;
  lon?: number | null;
};

export type Profile = {
  user_id: string;
  display_name: string;
  bio: string;
  phone: string;
  street_hint: string;
  skills: string[];
  help_offerings: string[];
  interests: string[];
  life_season: string;
  faith_posture: string;
  hoping_for: string;
  availability: string[];
  is_new_resident: boolean;
  is_youth: boolean;
  notify_events: boolean;
  notify_needs: boolean;
  notify_services: boolean;
  notify_facilities: boolean;
  welcome_seen: boolean;
  setting_pref: string;
  mobility: string;
  digest_opt_in: boolean;
  digest_cadence: string;
  home_zip: string;
  home_city: string;
  home_state: string;
  home_lat: number | null;
  home_lon: number | null;
};

export type Membership = {
  id: string;
  user_id: string;
  community_id: string;
  role: string;
  status: string;
  joined_via: string;
  is_primary: boolean;
  community?: Community;
};

export type Need = {
  id: string;
  community_id: string;
  user_id: string;
  author_name: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  is_paid: boolean;
  created_at: string;
  help_count?: number;
};

export type Service = {
  id: string;
  community_id: string;
  user_id: string;
  provider_name: string;
  title: string;
  description: string;
  category: string;
  pricing: string;
  price_note: string;
  is_business: boolean;
  is_youth: boolean;
  contact_hint: string;
  photo_url: string;
  portfolio_url: string;
  maker_bio: string;
  created_at: string;
};

export type ServiceInquiry = {
  id: string;
  service_id: string;
  user_id: string;
  inquirer_name: string;
  message: string;
  status: string;
  created_at: string;
  service_title?: string;
  provider_name?: string;
};

export type CommunityEvent = {
  id: string;
  community_id: string;
  user_id: string;
  host_name: string;
  title: string;
  description: string;
  kind: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  rsvp_count: number;
  created_at: string;
  has_rsvp?: boolean;
};

export type Facility = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  capacity: number | null;
  amenities: string[];
  rate_note: string;
  contact_name: string;
};

export type Neighbor = {
  user_id: string;
  display_name: string;
  bio: string;
  street_hint: string;
  skills: string[];
  help_offerings: string[];
  is_new_resident: boolean;
  is_youth: boolean;
  role: string;
};

export const SKILL_OPTIONS = [
  "Handyman",
  "Yard work",
  "Childcare",
  "Elder care",
  "Tech help",
  "Cooking",
  "Pet sitting",
  "Tutoring",
  "Tennis coaching",
  "Coaching",
  "Moving help",
  "Cleaning",
  "Car help",
  "Photography",
  "Music",
  "Organizing",
];

export const INTEREST_OPTIONS = [
  "Pickleball",
  "Tennis",
  "Sports",
  "Woodworking",
  "Welding",
  "Blacksmithing",
  "Spoon carving",
  "Nature",
  "Mushrooming",
  "Hiking",
  "Block parties",
  "Community cleanups",
  "Kids activities",
  "Senior visits",
  "Gardening",
  "Faith groups",
  "Book club",
  "Local business",
  "Knitting",
  "Crochet",
  "Fiber arts",
  "Movies",
  "Music",
  "Cooking",
  "Indoor games",
  "Story time",
  "Teaching",
  "Rock climbing",
  "Canoeing",
  "Sailing",
  "Karaoke",
  "Trivia",
  "Wine tasting",
];

export const SETTING_PREF_OPTIONS = [
  { id: "mixed", label: "Either indoor or outdoor is fine" },
  { id: "indoor", label: "I usually prefer indoor" },
  { id: "outdoor", label: "I usually prefer outdoor" },
];

export const MOBILITY_OPTIONS = [
  { id: "seated", label: "Mostly seated — library, crochet, a reading" },
  { id: "easy", label: "Easy going — I can get there and sit or stroll" },
  { id: "active", label: "Active — pickleball, tennis, I like to move" },
  { id: "high", label: "High energy — trails, climbing, canoeing" },
  { id: "mixed", label: "Depends on the day" },
];

export const LIFE_SEASON_OPTIONS = [
  { id: "divorced_dad", label: "I'm a divorced dad" },
  { id: "divorced_mom", label: "I'm a divorced mom" },
  { id: "single", label: "I'm single" },
  { id: "dating", label: "I'm dating" },
  { id: "married", label: "I'm married" },
  { id: "widowed", label: "I'm widowed" },
  { id: "prefer_not", label: "I'd rather not say" },
];

export const FAITH_POSTURE_OPTIONS = [
  { id: "rooted", label: "Deeply Christian — faith is home" },
  { id: "attending", label: "I go to church and I'm still wondering" },
  { id: "searching", label: "I'm searching" },
  { id: "questioning", label: "I'm questioning" },
  { id: "unsure", label: "I'm not sure what I believe" },
  { id: "prefer_not", label: "I'd rather not say" },
];

export const AVAILABILITY_OPTIONS = [
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
  "Flexible",
];

export const NEED_CATEGORIES = [
  { id: "household", label: "Household" },
  { id: "yard", label: "Yard & outdoor" },
  { id: "errands", label: "Errands" },
  { id: "tech", label: "Tech" },
  { id: "care", label: "Care & visits" },
  { id: "serve", label: "Volunteer / serve" },
  { id: "project", label: "Bigger project" },
  { id: "other", label: "Other" },
];

export const SERVICE_CATEGORIES = [
  { id: "household", label: "Household" },
  { id: "yard", label: "Yard" },
  { id: "kids", label: "Kids / youth" },
  { id: "coaching", label: "Coaching (tennis, pickleball, skills)" },
  { id: "restaurant", label: "Restaurant / nights out" },
  { id: "professional", label: "Professional" },
  { id: "care", label: "Care" },
  { id: "recreation", label: "Recreation" },
  { id: "artisan", label: "Maker / artisan" },
  { id: "wood", label: "Woodworking / carving" },
  { id: "fiber", label: "Fiber, textile & sewing" },
  { id: "metal", label: "Jewelry, metal & smithing" },
  { id: "visual", label: "Art, photo & print" },
  { id: "foodcraft", label: "Baked goods & food craft" },
  { id: "home_goods", label: "Handmade home goods" },
  { id: "other", label: "Other" },
];

export function serviceCategoryLabel(id: string): string {
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Physical inventory — not labor (that's Services) and not kids toys (Sandlot). */
export const TOOL_CATEGORIES = [
  { id: "lawn", label: "Lawn (mower, weed eater, trimmer, washer)" },
  { id: "power", label: "Power (electric / gas)" },
  { id: "automotive", label: "Automotive" },
  { id: "home_repair", label: "Home repair" },
  { id: "trailers", label: "Trailers" },
  { id: "outdoor", label: "Outdoor / garden" },
  { id: "other", label: "Other" },
];

export const TOOL_CONDITIONS = [
  { id: "excellent", label: "Excellent" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "needs_work", label: "Needs work" },
];

export function toolCategoryLabel(id: string): string {
  return TOOL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function toolConditionLabel(id: string): string {
  return TOOL_CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

export type Tool = {
  id: string;
  community_id: string;
  user_id: string;
  owner_name: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  photo_urls: string[];
  daily_rate_cents: number;
  replacement_value_cents: number;
  runs_ready: boolean;
  status: string;
  street_hint: string;
  created_at: string;
};

export type ToolBooking = {
  id: string;
  tool_id: string;
  community_id: string;
  owner_user_id: string;
  borrower_user_id: string;
  borrower_name: string;
  start_date: string;
  end_date: string;
  days: number;
  meetup_note: string;
  rental_cents: number;
  platform_fee_cents: number;
  owner_payout_cents: number;
  deposit_cents: number;
  status: string;
  payment_status: string;
  stripe_rental_intent_id: string;
  stripe_deposit_intent_id: string;
  owner_confirmed_return: boolean;
  borrower_confirmed_return: boolean;
  damage_note: string;
  admin_note: string;
  created_at: string;
  tool_title?: string;
  owner_name?: string;
};

export type ToolMessage = {
  id: string;
  booking_id: string;
  user_id: string;
  author_name: string;
  message: string;
  created_at: string;
};

export const EVENT_KINDS = [
  { id: "invite", label: "Who's interested? I'll host if people come" },
  { id: "quiet", label: "Quiet / seated (book club, crafts)" },
  { id: "active", label: "Active / outdoors" },
  { id: "restaurant", label: "Restaurant night (trivia, karaoke, special)" },
  { id: "social", label: "Social" },
  { id: "cleanup", label: "Cleanup" },
  { id: "kids", label: "Kids" },
  { id: "food", label: "Food / BBQ" },
  { id: "meeting", label: "Meeting" },
  { id: "serve", label: "Volunteer / serve" },
  { id: "other", label: "Other" },
];

export const KIND_LABELS: Record<CommunityKind, string> = {
  neighborhood: "Neighborhood",
  church: "Church / faith",
  school: "School",
  interest: "Interest group",
  vacation: "Vacation / second home",
};
