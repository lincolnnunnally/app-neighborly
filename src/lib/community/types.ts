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
  created_at: string;
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
  "Fiber arts",
  "Movies",
  "Music",
  "Cooking",
  "Indoor games",
];

export const SETTING_PREF_OPTIONS = [
  { id: "mixed", label: "Mix of indoor and outdoor" },
  { id: "indoor", label: "Mostly indoor" },
  { id: "outdoor", label: "Mostly outdoor" },
];

export const MOBILITY_OPTIONS = [
  { id: "mixed", label: "I can walk, sit, or hike" },
  { id: "seated", label: "I need seated / indoor-friendly options" },
  { id: "walking", label: "I want to be on my feet outside" },
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
  { id: "professional", label: "Professional" },
  { id: "care", label: "Care" },
  { id: "other", label: "Other" },
];

export const EVENT_KINDS = [
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
