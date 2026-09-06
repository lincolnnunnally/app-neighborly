import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Hammer,
  HandHeart,
  Link2,
  MapPin,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { CommunityCover } from "@/components/community/cover";
import { useRequireNeighbor } from "@/components/community/use-require-neighbor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelRsvp,
  createEvent,
  createNeed,
  getCommunityFeed,
  getInterestDemand,
  listOffersForNeed,
  offerHelp,
  inquireService,
  requestFacility,
  rsvpEvent,
  type HelpOffer,
} from "@/lib/community/server";
import { bookTool } from "@/lib/community/tools-server";
import { formatCents, quoteToolRental, rentalDays } from "@/lib/community/payments";
import {
  EVENT_KINDS,
  SERVICE_CATEGORIES,
  TOOL_CATEGORIES,
  serviceCategoryLabel,
  toolCategoryLabel,
  toolConditionLabel,
  type Community,
  type CommunityEvent,
  type Facility,
  type Need,
  type Neighbor,
  type Service,
  type Tool,
} from "@/lib/community/types";
import { OFFER_SERVICE_PATH, OFFER_TOOL_PATH } from "@/lib/community/offer-path";
import { formatEventWhen } from "@/lib/utils";
import { ActivityFilters, matchesDateWindow, type DateWindow } from "@/components/community/activity-filters";

type BoardSearch = { tab?: string; cat?: string };

export const Route = createFileRoute("/c/$slug")({
  validateSearch: (s: Record<string, unknown>): BoardSearch => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  loader: async ({ params }) => {
    try {
      return await getCommunityFeed({ data: { slug: params.slug } });
    } catch {
      return {
        community: null,
        needs: [],
        services: [],
        tools: [],
        events: [],
        facilities: [],
        neighbors: [],
      };
    }
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.community;
    const name = c?.name || params.slug;
    const city = c ? `${c.city}, ${c.state}` : name;
    const title = `What's going on in ${name} — Neighborly`;
    const description = c?.tagline
      ? `${c.tagline} Public board for ${city}. We will not invent neighbors or events.`
      : `Neighbor board for ${city}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CommunityPublicPage,
});

function CommunityPublicPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const loaded = Route.useLoaderData();
  const { user, ensureReady } = useRequireNeighbor();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(loaded.community);
  const [needs, setNeeds] = useState<Need[]>(loaded.needs);
  const [services, setServices] = useState<Service[]>(loaded.services);
  const [tools, setTools] = useState<Tool[]>(loaded.tools ?? []);
  const [events, setEvents] = useState<CommunityEvent[]>(loaded.events);
  const [facilities, setFacilities] = useState<Facility[]>(loaded.facilities);
  const [neighbors, setNeighbors] = useState<Neighbor[]>(loaded.neighbors);
  const [demand, setDemand] = useState<{ interest: string; n: number }[]>([]);
  const [loading, setLoading] = useState(!loaded.community);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState(
    () => search.tab || (slug.startsWith("vidalia") ? "events" : "needs"),
  );
  const [eventDate, setEventDate] = useState<DateWindow>("week");
  const [eventKind, setEventKind] = useState("all");

  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [needOffers, setNeedOffers] = useState<HelpOffer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [helpMessage, setHelpMessage] = useState("I can help — when works for you?");
  const [activeEvent, setActiveEvent] = useState<CommunityEvent | null>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [serviceMessage, setServiceMessage] = useState("Hi — I'd like to ask about this.");
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [borrowStart, setBorrowStart] = useState("");
  const [borrowEnd, setBorrowEnd] = useState("");
  const [borrowNote, setBorrowNote] = useState("I can pick up and return on time.");
  const [activeFacility, setActiveFacility] = useState<Facility | null>(null);
  const [bookPurpose, setBookPurpose] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [showPostNeed, setShowPostNeed] = useState(false);
  const [needTitle, setNeedTitle] = useState("");
  const [needDesc, setNeedDesc] = useState("");
  const [showHost, setShowHost] = useState(false);
  const [hostTitle, setHostTitle] = useState("");
  const [hostDesc, setHostDesc] = useState("");
  const [hostWhere, setHostWhere] = useState("");
  const [hostWhen, setHostWhen] = useState("");
  const [hostKind, setHostKind] = useState("invite");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function reload() {
    const feed = await getCommunityFeed({
      data: { slug, userId: user?.id },
    });
    setCommunity(feed.community);
    setNeeds(feed.needs);
    setServices(feed.services);
    setTools(feed.tools);
    setEvents(feed.events);
    setFacilities(feed.facilities);
    setNeighbors(feed.neighbors);
    if (activeNeed) {
      const updated = feed.needs.find((n) => n.id === activeNeed.id) ?? null;
      setActiveNeed(updated);
      if (updated) {
        setNeedOffers(await listOffersForNeed({ data: updated.id }));
      }
    }
    if (activeEvent) {
      setActiveEvent(feed.events.find((e) => e.id === activeEvent.id) ?? null);
    }
  }

  useEffect(() => {
    setTab(search.tab || (slug.startsWith("vidalia") ? "events" : "needs"));
    setLoading(true);
    setLoadError(false);
    reload()
      .then(() => setLoadError(false))
      .catch(() => {
        setCommunity(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
    getInterestDemand({ data: { slug } })
      .then((d) => setDemand(d.counts.filter((c) => c.n > 0)))
      .catch(() => setDemand([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id, search.tab]);

  async function openNeed(n: Need) {
    setActiveNeed(n);
    setHelpMessage("I can help — when works for you?");
    try {
      setNeedOffers(await listOffersForNeed({ data: n.id }));
      setOffersError(null);
    } catch {
      setNeedOffers([]);
      setOffersError("Could not load offers for this need.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg">
        <SiteHeader solid />
        <div className="page-shell py-10">
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-dvh bg-bg">
        <SiteHeader solid />
        <div className="page-shell py-16">
          <h1 className="font-display text-2xl font-semibold">
            {loadError ? "Could not load this community" : "Community not found"}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {loadError
              ? "The board failed to load. Refresh, or browse other communities."
              : "That link does not match a community on Neighborly."}
          </p>
          <Button asChild className="mt-4">
            <Link to="/communities">Browse communities</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg pb-16">
      <SiteHeader solid />
      <main className="page-shell space-y-6 py-8">
        <CommunityCover community={community} />

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={demoBusy}
            onClick={async () => {
              setDemoBusy(true);
              try {
                if (user) {
                  await navigate({ to: "/app" });
                  return;
                }
                await navigate({
                  to: "/signup",
                  search: { community: community.slug, code: community.invite_code },
                });
              } finally {
                setDemoBusy(false);
              }
            }}
          >
            {user ? "Open my hub" : demoBusy ? "Joining…" : "Join & start helping"}
          </Button>
          <Button asChild variant="secondary">
            <Link to="/weekend" search={{ place: slug }}>This weekend</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link
              to="/churches"
              search={{
                zip: community.zip || undefined,
                city: community.city || undefined,
                state: community.state || undefined,
              }}
            >
              Churches
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/join/$code" params={{ code: community.invite_code }}>
              Invite link & QR
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShowPostNeed(true)}>
            Post a need
          </Button>
          <Button variant="outline" onClick={() => setShowHost(true)}>
            Host / who's interested
          </Button>
        </div>

        <p className="max-w-3xl text-fg-muted">{community.description}</p>
        <p className="text-sm text-fg-subtle">
          Browse freely. To RSVP, offer help, or book a place, create a real
          account — we will not invent a neighbor for you.
        </p>
        {demand.length > 0 && (
          <aside className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-4">
            <p className="text-sm font-medium text-fg">What neighbors here actually marked</p>
            <p className="mt-1 text-xs text-fg-subtle">
              Real profiles only. A church, library, or organizer can host a first table — we
              do not invent a class or email a room that does not exist.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {demand.map((d) => (
                <li key={d.interest}>
                  <Badge variant="secondary">
                    {d.interest} · {d.n}
                  </Badge>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <Tabs
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            void navigate({
              to: "/c/$slug",
              params: { slug },
              search: {
                tab: next,
                cat: next === "services" || next === "tools" ? search.cat : undefined,
              },
              replace: true,
            });
          }}
        >
          <TabsList className="grid grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="needs">Needs</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="places">Places</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>

          <TabsContent value="needs" className="space-y-3">
            {needs.map((n) => (
              <button
                key={n.id}
                type="button"
                data-testid={`need-${n.id}`}
                onClick={() => void openNeed(n)}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      n.urgency === "urgent"
                        ? "danger"
                        : n.urgency === "soon"
                          ? "accent"
                          : "secondary"
                    }
                  >
                    {n.urgency}
                  </Badge>
                  <Badge variant="outline">{n.category}</Badge>
                  {n.is_paid && <Badge variant="sky">paid / trade ok</Badge>}
                  {n.status !== "open" && <Badge>{n.status}</Badge>}
                </div>
                <h3 className="font-medium text-fg">{n.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{n.description}</p>
                <p className="mt-3 text-xs text-fg-subtle">
                  {n.author_name} · {n.help_count ?? 0} offers · tap to respond
                </p>
              </button>
            ))}
            {needs.length === 0 && (
              <p className="text-sm text-fg-muted">
                No needs posted yet. Be the first — ask for a hand, or offer one.
              </p>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                data-testid="offer-service"
                onClick={async () => {
                  if (user) {
                    await navigate({ to: OFFER_SERVICE_PATH });
                    return;
                  }
                  const ok = await ensureReady({
                    code: community.invite_code,
                    community: community.slug,
                    next: OFFER_SERVICE_PATH,
                  });
                  if (ok) await navigate({ to: OFFER_SERVICE_PATH });
                }}
              >
                Offer a service
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = `${window.location.origin}/c/${slug}?tab=services${search.cat ? `&cat=${search.cat}` : ""}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Services link copied");
                  } catch {
                    toast.message(url);
                  }
                }}
              >
                <Link2 className="h-4 w-4" />
                Share services
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/c/$slug",
                    params: { slug },
                    search: { tab: "services", cat: undefined },
                    replace: true,
                  })
                }
                className={
                  !search.cat
                    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                    : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
                }
              >
                All
              </button>
              {SERVICE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/c/$slug",
                      params: { slug },
                      search: { tab: "services", cat: c.id },
                      replace: true,
                    })
                  }
                  className={
                    search.cat === c.id
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                      : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
            {services
              .filter((s) => !search.cat || s.category === search.cat)
              .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveService(s);
                  setServiceMessage("Hi — I'd like to ask about this.");
                }}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                {s.photo_url ? (
                  <img
                    src={s.photo_url}
                    alt=""
                    className="mb-3 h-36 w-full rounded-[var(--radius-md)] object-cover"
                  />
                ) : null}
                <div className="mb-2 flex flex-wrap gap-2">
                  {s.is_business && <Badge>Business</Badge>}
                  {s.is_youth && <Badge variant="accent">Youth</Badge>}
                  <Badge variant="outline">{s.pricing}</Badge>
                  <Badge variant="secondary">{serviceCategoryLabel(s.category)}</Badge>
                </div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="line-clamp-2 text-sm text-fg-muted">{s.description}</p>
                <p className="mt-2 text-xs text-fg-subtle">
                  {s.provider_name}
                  {s.price_note ? ` · ${s.price_note}` : ""} · tap to message
                </p>
              </button>
            ))}
            {services.filter((s) => !search.cat || s.category === search.cat).length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-fg-muted">
                  {services.length
                    ? "Nothing in this category yet. Show all, or be the first maker listed."
                    : "No services listed yet. Offer a skill — signup and community join first if you need them, then register."}
                </p>
                <Button
                  data-testid="offer-service-empty"
                  onClick={async () => {
                    if (user) {
                      await navigate({ to: OFFER_SERVICE_PATH });
                      return;
                    }
                    const ok = await ensureReady({
                      code: community.invite_code,
                      community: community.slug,
                      next: OFFER_SERVICE_PATH,
                    });
                    if (ok) await navigate({ to: OFFER_SERVICE_PATH });
                  }}
                >
                  Offer a service
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                data-testid="list-tool"
                onClick={async () => {
                  if (user) {
                    await navigate({ to: OFFER_TOOL_PATH, search: { register: "1" } });
                    return;
                  }
                  const ok = await ensureReady({
                    code: community.invite_code,
                    community: community.slug,
                    next: OFFER_TOOL_PATH,
                  });
                  if (ok) await navigate({ to: OFFER_TOOL_PATH, search: { register: "1" } });
                }}
              >
                List a tool
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = `${window.location.origin}/c/${slug}?tab=tools${search.cat ? `&cat=${search.cat}` : ""}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Tools link copied");
                  } catch {
                    toast.message(url);
                  }
                }}
              >
                <Link2 className="h-4 w-4" />
                Share tools
              </Button>
            </div>
            <p className="text-sm text-fg-muted">
              Physical tools only — mowers, welders, trailers. Skill and labor stay on Services.
              Kids toys stay on Sandlot.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/c/$slug",
                    params: { slug },
                    search: { tab: "tools", cat: undefined },
                    replace: true,
                  })
                }
                className={
                  !search.cat
                    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                    : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
                }
              >
                All
              </button>
              {TOOL_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/c/$slug",
                      params: { slug },
                      search: { tab: "tools", cat: c.id },
                      replace: true,
                    })
                  }
                  className={
                    search.cat === c.id
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                      : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
                  }
                >
                  {c.label.split(" (")[0]}
                </button>
              ))}
            </div>
            {tools
              .filter((t) => !search.cat || t.category === search.cat)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`tool-${t.id}`}
                  onClick={() => {
                    setActiveTool(t);
                    setBorrowNote("I can pick up and return on time.");
                    setBorrowStart("");
                    setBorrowEnd("");
                  }}
                  className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
                >
                  {t.photo_urls[0] ? (
                    <img
                      src={t.photo_urls[0]}
                      alt=""
                      className="mb-3 h-36 w-full rounded-[var(--radius-md)] object-cover"
                    />
                  ) : null}
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{toolCategoryLabel(t.category).split(" (")[0]}</Badge>
                    <Badge variant="outline">{toolConditionLabel(t.condition)}</Badge>
                    {t.runs_ready && <Badge variant="sky">Runs ready</Badge>}
                  </div>
                  <h3 className="font-medium">{t.title}</h3>
                  <p className="line-clamp-2 text-sm text-fg-muted">{t.description}</p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    {formatCents(t.daily_rate_cents)}/day · replacement{" "}
                    {formatCents(t.replacement_value_cents)}
                    {t.street_hint ? ` · ${t.street_hint}` : ""} · tap to request
                  </p>
                </button>
              ))}
            {tools.filter((t) => !search.cat || t.category === search.cat).length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-fg-muted">
                  {tools.length
                    ? "Nothing in this category yet. Show all, or list the first tool."
                    : "No tools listed yet. List a tool neighbors can borrow."}
                </p>
                <Button
                  data-testid="list-tool-empty"
                  onClick={async () => {
                    if (user) {
                      await navigate({ to: OFFER_TOOL_PATH, search: { register: "1" } });
                      return;
                    }
                    const ok = await ensureReady({
                      code: community.invite_code,
                      community: community.slug,
                      next: OFFER_TOOL_PATH,
                    });
                    if (ok) await navigate({ to: OFFER_TOOL_PATH, search: { register: "1" } });
                  }}
                >
                  List a tool
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            <ActivityFilters
              dateWindow={eventDate}
              onDateWindow={setEventDate}
              kind={eventKind}
              onKind={setEventKind}
              kinds={[{ id: "all", label: "All kinds" }, ...EVENT_KINDS]}
            />
            {events
              .filter((e) => matchesDateWindow(e.starts_at, eventDate) && (eventKind === "all" || e.kind === eventKind))
              .map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setActiveEvent(e)}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="sky">{e.kind}</Badge>
                  {e.host_name === "Public listing" && <Badge variant="outline">Public listing</Badge>}
                  {e.kind === "invite" && <Badge variant="accent">Who's interested</Badge>}
                  <span className="text-xs text-fg-muted">{formatEventWhen(e.starts_at)}</span>
                  {e.has_rsvp && <Badge>Going</Badge>}
                </div>
                <h3 className="font-medium">{e.title}</h3>
                <p className="line-clamp-2 text-sm text-fg-muted">{e.description}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-fg-subtle">
                  <MapPin className="h-3.5 w-3.5" />
                  {e.location || "TBA"} · {e.rsvp_count}{" "}
                  {e.kind === "invite" ? "interested" : "going"} · tap to respond
                </p>
              </button>
            ))}
            {events.filter((e) => matchesDateWindow(e.starts_at, eventDate) && (eventKind === "all" || e.kind === eventKind)).length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-fg-muted">
                  {events.length
                    ? "Nothing in this date or kind filter. Choose This week or All dates to see the rest of the board."
                    : "Nothing dated yet. If the town is quiet, host the first table — a book club, crochet, spoon carving, trivia at a restaurant, tennis. We will not invent a crowd."}
                </p>
                <Button size="sm" onClick={() => setShowHost(true)}>
                  Ask who&apos;s interested
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="places" className="space-y-3">
            {facilities.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFacility(f);
                  setBookPurpose("");
                  setBookDate("");
                  setBookTime("");
                }}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                <h3 className="font-medium">{f.name}</h3>
                <p className="text-sm text-fg-muted">{f.description}</p>
                <p className="mt-2 text-xs text-fg-subtle">
                  Capacity {f.capacity ?? "—"} · {f.rate_note} · tap to request
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.amenities.map((a) => (
                    <Badge key={a} variant="outline">
                      {a}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
            {facilities.length === 0 && (
              <p className="text-sm text-fg-muted">No facilities listed yet.</p>
            )}
          </TabsContent>

          <TabsContent value="people" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {neighbors.map((n) => (
                <article key={n.user_id} className="surface-card p-4">
                  <div className="mb-1 flex flex-wrap gap-2">
                    {n.is_new_resident && <Badge variant="accent">New resident</Badge>}
                    {n.is_youth && <Badge variant="sky">Youth</Badge>}
                    <Badge variant="outline">{n.role}</Badge>
                  </div>
                  <h3 className="font-medium">{n.display_name}</h3>
                  <p className="text-sm text-fg-muted">{n.bio || "Neighbor in this community"}</p>
                  {n.street_hint && (
                    <p className="mt-1 text-xs text-fg-subtle">{n.street_hint}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.skills.slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {neighbors.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <Users className="h-4 w-4" /> Be the first real member to join.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!activeNeed} onOpenChange={(o) => !o && setActiveNeed(null)}>
        <DialogContent>
          {activeNeed && (
            <>
              <DialogHeader>
                <DialogTitle>{activeNeed.title}</DialogTitle>
                <DialogDescription>
                  {activeNeed.author_name} · {activeNeed.category} · {activeNeed.urgency} ·{" "}
                  {activeNeed.status}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{activeNeed.description}</p>
              {activeNeed.is_paid && (
                <Badge variant="sky" className="w-fit">
                  Willing to pay or trade
                </Badge>
              )}
              <div className="space-y-2">
                <Label>Your message to {activeNeed.author_name}</Label>
                <Textarea
                  value={helpMessage}
                  onChange={(e) => setHelpMessage(e.target.value)}
                />
              </div>
              {offersError && (
                <p className="text-sm text-red-600">{offersError}</p>
              )}
              {needOffers.length > 0 && (
                <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
                  <p className="text-xs font-medium text-fg-muted">
                    {needOffers.length} offer{needOffers.length === 1 ? "" : "s"} so far
                  </p>
                  {needOffers.map((o) => (
                    <div key={o.id} className="text-sm">
                      <span className="font-medium">{o.helper_name}</span>
                      <span className="text-fg-muted"> · {o.status}</span>
                      {o.message && <p className="text-fg-muted">{o.message}</p>}
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveNeed(null)}>
                  Close
                </Button>
                <Button
                  disabled={busy || activeNeed.user_id === user?.id}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await ensureReady({ code: community.invite_code });
                      if (!ok) return;
                      const res = await offerHelp({
                        data: { needId: activeNeed.id, message: helpMessage },
                      });
                      toast.success(
                        res.already
                          ? "You already offered help on this one"
                          : "Help offered — they can accept in their hub",
                      );
                      await reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not offer help");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <HandHeart className="h-4 w-4" />
                  {busy ? "Sending…" : "I can help"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeEvent} onOpenChange={(o) => !o && setActiveEvent(null)}>
        <DialogContent>
          {activeEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{activeEvent.title}</DialogTitle>
                <DialogDescription>
                  {formatEventWhen(activeEvent.starts_at)} · {activeEvent.kind}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{activeEvent.description}</p>
              <p className="text-sm text-fg-muted">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {activeEvent.location || "Location TBA"} · hosted by {activeEvent.host_name}
              </p>
              <p className="text-sm font-medium">
                {activeEvent.rsvp_count}{" "}
                {activeEvent.kind === "invite" ? "neighbors interested" : "neighbors going"}
              </p>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveEvent(null)}>
                  Close
                </Button>
                {activeEvent.has_rsvp ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await cancelRsvp({ data: activeEvent.id });
                        toast.success("RSVP cancelled");
                        await reload();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not cancel");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel RSVP
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const ok = await ensureReady({ code: community.invite_code });
                        if (!ok) return;
                        await rsvpEvent({ data: activeEvent.id });
                        toast.success(
                          activeEvent.kind === "invite"
                            ? "You're interested. If this becomes a real table, the host can find you."
                            : "You're on the list. Showing up is the win — not this page.",
                        );
                        await reload();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not RSVP");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <CalendarDays className="h-4 w-4" />
                    {busy ? "Saving…" : activeEvent.kind === "invite" ? "I'm interested" : "RSVP"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeService} onOpenChange={(o) => !o && setActiveService(null)}>
        <DialogContent>
          {activeService && (
            <>
              <DialogHeader>
                <DialogTitle>{activeService.title}</DialogTitle>
                <DialogDescription>
                  {activeService.provider_name}
                  {activeService.is_youth ? " · youth offering" : ""}
                  {activeService.is_business ? " · local business" : ""}
                  {` · ${serviceCategoryLabel(activeService.category)}`}
                </DialogDescription>
              </DialogHeader>
              {activeService.photo_url ? (
                <img
                  src={activeService.photo_url}
                  alt=""
                  className="h-40 w-full rounded-[var(--radius-md)] object-cover"
                />
              ) : null}
              <p className="text-sm text-fg">{activeService.description}</p>
              {activeService.maker_bio ? (
                <p className="text-sm text-fg-muted">{activeService.maker_bio}</p>
              ) : null}
              <p className="text-sm text-fg-muted">
                {activeService.pricing}
                {activeService.price_note ? ` · ${activeService.price_note}` : ""}
              </p>
              {activeService.portfolio_url ? (
                <a
                  href={activeService.portfolio_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Portfolio / shop
                </a>
              ) : null}
              {activeService.contact_hint ? (
                <p className="rounded-[var(--radius-md)] bg-primary-soft px-3 py-2 text-sm text-primary">
                  Also: {activeService.contact_hint}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label>Message via Neighborly</Label>
                <Textarea
                  value={serviceMessage}
                  onChange={(e) => setServiceMessage(e.target.value)}
                  placeholder="What do you need, and when?"
                />
                <p className="text-xs text-fg-subtle">
                  Join first if you have not. We save the message for the provider — no
                  payments here.
                </p>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveService(null)}>
                  Close
                </Button>
                <Button
                  disabled={busy || activeService.user_id === user?.id}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await ensureReady({
                        code: community.invite_code,
                        community: community.slug,
                        next: `/c/${community.slug}?tab=services`,
                      });
                      if (!ok) return;
                      const res = await inquireService({
                        data: { serviceId: activeService.id, message: serviceMessage },
                      });
                      toast.success(
                        res.already
                          ? "You already messaged them about this listing"
                          : "Message sent — they will see it in their hub",
                      );
                      setActiveService(null);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not send message");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Wrench className="h-4 w-4" />
                  {busy ? "Sending…" : "Message via Neighborly"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeTool} onOpenChange={(o) => !o && setActiveTool(null)}>
        <DialogContent>
          {activeTool && (
            <>
              <DialogHeader>
                <DialogTitle>{activeTool.title}</DialogTitle>
                <DialogDescription>
                  {activeTool.owner_name}
                  {` · ${toolCategoryLabel(activeTool.category)}`}
                  {` · ${toolConditionLabel(activeTool.condition)}`}
                </DialogDescription>
              </DialogHeader>
              {activeTool.photo_urls[0] ? (
                <img
                  src={activeTool.photo_urls[0]}
                  alt=""
                  className="h-40 w-full rounded-[var(--radius-md)] object-cover"
                />
              ) : null}
              <p className="text-sm text-fg">{activeTool.description}</p>
              <p className="text-sm text-fg-muted">
                {formatCents(activeTool.daily_rate_cents)}/day · replacement value{" "}
                {formatCents(activeTool.replacement_value_cents)}
                {activeTool.street_hint ? ` · ${activeTool.street_hint}` : ""}
              </p>
              {borrowStart && borrowEnd ? (
                <p className="text-xs text-fg-subtle">
                  {(() => {
                    try {
                      const q = quoteToolRental({
                        daily_rate_cents: activeTool.daily_rate_cents,
                        days: rentalDays(borrowStart, borrowEnd),
                        replacement_value_cents: activeTool.replacement_value_cents,
                      });
                      return `${q.days} day${q.days === 1 ? "" : "s"} · rental ${formatCents(q.rental_cents)} (owner keeps ${formatCents(q.owner_payout_cents)}, 15% fee ${formatCents(q.platform_fee_cents)}) · deposit hold ${formatCents(q.deposit_cents)}`;
                    } catch {
                      return "Pick a valid date range";
                    }
                  })()}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Pickup date</Label>
                  <Input
                    type="date"
                    value={borrowStart}
                    onChange={(e) => setBorrowStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Return date</Label>
                  <Input
                    type="date"
                    value={borrowEnd}
                    onChange={(e) => setBorrowEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Meetup notes</Label>
                <Textarea
                  value={borrowNote}
                  onChange={(e) => setBorrowNote(e.target.value)}
                  placeholder="Where and when to pick up and return"
                />
                <p className="text-xs text-fg-subtle">
                  Payments coming soon — booking reserved. Arrange pickup in these notes, same
                  as other Neighborly messages.
                </p>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveTool(null)}>
                  Close
                </Button>
                <Button
                  disabled={busy || activeTool.user_id === user?.id}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await ensureReady({
                        code: community.invite_code,
                        community: community.slug,
                        next: `/c/${community.slug}?tab=tools`,
                      });
                      if (!ok) return;
                      if (!borrowStart || !borrowEnd) {
                        toast.error("Pick pickup and return dates");
                        return;
                      }
                      const res = await bookTool({
                        data: {
                          toolId: activeTool.id,
                          start_date: borrowStart,
                          end_date: borrowEnd,
                          meetup_note: borrowNote,
                        },
                      });
                      toast.success(res.message);
                      setActiveTool(null);
                      await reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not reserve");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Hammer className="h-4 w-4" />
                  {busy ? "Reserving…" : "Request borrow"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeFacility} onOpenChange={(o) => !o && setActiveFacility(null)}>
        <DialogContent>
          {activeFacility && (
            <>
              <DialogHeader>
                <DialogTitle>{activeFacility.name}</DialogTitle>
                <DialogDescription>{activeFacility.rate_note}</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{activeFacility.description}</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>What's the gathering?</Label>
                  <Input
                    value={bookPurpose}
                    onChange={(e) => setBookPurpose(e.target.value)}
                    placeholder="Birthday party, reunion, club meeting…"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time note</Label>
                    <Input
                      value={bookTime}
                      onChange={(e) => setBookTime(e.target.value)}
                      placeholder="2–6pm"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveFacility(null)}>
                  Close
                </Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await ensureReady({ code: community.invite_code });
                      if (!ok) return;
                      await requestFacility({
                        data: {
                          facilityId: activeFacility.id,
                          communityId: community.id,
                          purpose: bookPurpose,
                          date_on: bookDate,
                          time_note: bookTime,
                        },
                      });
                      toast.success("Reservation requested");
                      setActiveFacility(null);
                      await reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not request");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Request reservation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHost} onOpenChange={setShowHost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Host something in {community.name}</DialogTitle>
            <DialogDescription>
              Book club, crochet, tennis, trivia, spoon carving. Posting is free. We will
              not invent people who said yes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>What is it?</Label>
              <Input
                value={hostTitle}
                onChange={(e) => setHostTitle(e.target.value)}
                placeholder="Saturday spoon carving, or library book club"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea
                value={hostDesc}
                onChange={(e) => setHostDesc(e.target.value)}
                placeholder="Seated or active, indoor or outdoor, beginners welcome…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_KINDS.slice(0, 6).map((k) => (
                  <Button
                    key={k.id}
                    type="button"
                    size="sm"
                    variant={hostKind === k.id ? "default" : "outline"}
                    onClick={() => setHostKind(k.id)}
                  >
                    {k.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>When (proposed)</Label>
                <Input
                  type="datetime-local"
                  value={hostWhen}
                  onChange={(e) => setHostWhen(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Where</Label>
                <Input
                  value={hostWhere}
                  onChange={(e) => setHostWhere(e.target.value)}
                  placeholder="Library, park, restaurant…"
                />
              </div>
            </div>
            <p className="text-xs text-fg-subtle">
              A paid highlight or banner is not for sale yet. Free post first. We will not
              take money until a sponsored slot is actually shown to neighbors.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowHost(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await ensureReady({ code: community.invite_code });
                  if (!ok) return;
                  if (!hostTitle.trim() || !hostWhen) {
                    toast.error("Add a title and a proposed time");
                    return;
                  }
                  await createEvent({
                    data: {
                      communityId: community.id,
                      title: hostTitle,
                      description: hostDesc,
                      kind: hostKind,
                      location: hostWhere,
                      starts_at: new Date(hostWhen).toISOString(),
                    },
                  });
                  toast.success(
                    hostKind === "invite"
                      ? "Posted. Neighbors can tap interested — no invented crowd."
                      : "Gathering posted.",
                  );
                  setShowHost(false);
                  setHostTitle("");
                  setHostDesc("");
                  setHostWhere("");
                  setHostWhen("");
                  setTab("events");
                  await reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not post");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Posting…" : hostKind === "invite" ? "Ask who's interested" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPostNeed} onOpenChange={setShowPostNeed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask {community.name} for help</DialogTitle>
            <DialogDescription>
              From changing a lightbulb to finding hands for a bigger project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>What do you need?</Label>
              <Input
                value={needTitle}
                onChange={(e) => setNeedTitle(e.target.value)}
                placeholder="Help hanging shelves this weekend"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea
                value={needDesc}
                onChange={(e) => setNeedDesc(e.target.value)}
                placeholder="Timing, tools, accessibility notes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowPostNeed(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await ensureReady({ code: community.invite_code });
                  if (!ok) return;
                  await createNeed({
                    data: {
                      communityId: community.id,
                      title: needTitle,
                      description: needDesc,
                      category: "household",
                      urgency: "normal",
                    },
                  });
                  toast.success("Need posted to the community");
                  setShowPostNeed(false);
                  setNeedTitle("");
                  setNeedDesc("");
                  setTab("needs");
                  await reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not post need");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish need
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
