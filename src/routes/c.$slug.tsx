import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  HandHeart,
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
  createNeed,
  getCommunityFeed,
  listOffersForNeed,
  offerHelp,
  requestFacility,
  rsvpEvent,
  type HelpOffer,
} from "@/lib/community/server";
import type {
  Community,
  CommunityEvent,
  Facility,
  Need,
  Neighbor,
  Service,
} from "@/lib/community/types";
import { formatEventWhen } from "@/lib/utils";

export const Route = createFileRoute("/c/$slug")({
  component: CommunityPublicPage,
});

function CommunityPublicPage() {
  const { slug } = Route.useParams();
  const { user, ensureReady } = useRequireNeighbor();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState("needs");

  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [needOffers, setNeedOffers] = useState<HelpOffer[]>([]);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [helpMessage, setHelpMessage] = useState("I can help — when works for you?");
  const [activeEvent, setActiveEvent] = useState<CommunityEvent | null>(null);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [activeFacility, setActiveFacility] = useState<Facility | null>(null);
  const [bookPurpose, setBookPurpose] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [showPostNeed, setShowPostNeed] = useState(false);
  const [needTitle, setNeedTitle] = useState("");
  const [needDesc, setNeedDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function reload() {
    const feed = await getCommunityFeed({
      data: { slug, userId: user?.id },
    });
    setCommunity(feed.community);
    setNeeds(feed.needs);
    setServices(feed.services);
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
    setLoading(true);
    setLoadError(false);
    reload()
      .then(() => setLoadError(false))
      .catch(() => {
        setCommunity(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

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
            <Link to="/join/$code" params={{ code: community.invite_code }}>
              Invite link & QR
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShowPostNeed(true)}>
            Post a need
          </Button>
        </div>

        <p className="max-w-3xl text-fg-muted">{community.description}</p>
        <p className="text-sm text-fg-subtle">
          Tap any card to open it. Actions (help, RSVP, book) work for real — if
          you're not signed in yet, we start a neighbor session for you.
        </p>
        <p className="mt-3">
          <Link to="/weekend" className="text-sm font-medium text-primary underline">
            Plan this weekend with weather and a calendar file
          </Link>
        </p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-5">
            <TabsTrigger value="needs">Needs</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
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
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveService(s)}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="mb-2 flex flex-wrap gap-2">
                  {s.is_business && <Badge>Business</Badge>}
                  {s.is_youth && <Badge variant="accent">Youth</Badge>}
                  <Badge variant="outline">{s.pricing}</Badge>
                </div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="line-clamp-2 text-sm text-fg-muted">{s.description}</p>
                <p className="mt-2 text-xs text-fg-subtle">
                  {s.provider_name}
                  {s.price_note ? ` · ${s.price_note}` : ""} · tap for contact
                </p>
              </button>
            ))}
            {services.length === 0 && (
              <p className="text-sm text-fg-muted">
                No services listed yet. Offer a skill when you join.
              </p>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            {events.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setActiveEvent(e)}
                className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="sky">{e.kind}</Badge>
                  {e.host_name === "Public listing" && <Badge variant="outline">Public listing</Badge>}
                  <span className="text-xs text-fg-muted">{formatEventWhen(e.starts_at)}</span>
                  {e.has_rsvp && <Badge>Going</Badge>}
                </div>
                <h3 className="font-medium">{e.title}</h3>
                <p className="line-clamp-2 text-sm text-fg-muted">{e.description}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-fg-subtle">
                  <MapPin className="h-3.5 w-3.5" />
                  {e.location || "TBA"} · {e.rsvp_count} going · tap to RSVP
                </p>
              </button>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-fg-muted">
                No gatherings posted yet. Plan the first one from your hub.
              </p>
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
              <p className="text-sm font-medium">{activeEvent.rsvp_count} neighbors going</p>
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
                        toast.success("You're on the list. Showing up is the win — not this page.");
                        await reload();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not RSVP");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <CalendarDays className="h-4 w-4" />
                    {busy ? "Saving…" : "RSVP"}
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
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{activeService.description}</p>
              <p className="text-sm text-fg-muted">
                {activeService.pricing}
                {activeService.price_note ? ` · ${activeService.price_note}` : ""}
              </p>
              <p className="rounded-[var(--radius-md)] bg-primary-soft px-3 py-2 text-sm text-primary">
                Contact: {activeService.contact_hint || "Message via Neighborly after you join"}
              </p>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActiveService(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    toast.message(
                      `We do not save interest yet. Use the contact above to reach ${activeService.title}.`,
                    );
                  }}
                >
                  <Wrench className="h-4 w-4" />
                  How do I reach them?
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
