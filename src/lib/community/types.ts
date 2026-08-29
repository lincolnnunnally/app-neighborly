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
  is_new_resident: boolean;
  is_youth: boolean;
  notify_events: boolean;
  notify_needs: boolean;
  notify_services: boolean;
  notify_facilities: boolean;
  welcome_seen: boolean;
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
  "Block parties",
  "Community cleanups",
  "Kids activities",
  "Senior visits",
  "Gardening",
  "Sports",
  "Faith groups",
  "Book club",
  "Local business",
  "Emergency preparedness",
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
