import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PantryDetails } from "@/components/community/pantry-details";
import { PantryMap } from "@/components/community/pantry-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { CC_GET_HELP, isPantry, isPublicListing } from "@/lib/community/pantry";
import { parseQuery, scoreFields } from "@/lib/community/search";
import {
  createPantryListing,
  getCommunityFeed,
  getMyMemberships,
  listMyBookings,
  listMyPantryListings,
  requestFacility,
  updatePantryListing,
  type FacilityBooking,
} from "@/lib/community/server";
import type { Facility, Membership } from "@/lib/community/types";

type PlacesSearch = { register?: string };

export const Route = createFileRoute("/app/places")({
  validateSearch: (s: Record<string, unknown>): PlacesSearch => ({
    register: typeof s.register === "string" ? s.register : undefined,
  }),
  component: PlacesPage,
});

const emptyForm = {
  name: "",
  address: "",
  city: "Vidalia",
  zip: "30474",
  serve_days: "",
  serve_times: "",
  residency_note: "",
  visit_frequency: "",
  id_docs: "",
  other_notes: "",
  phone: "",
  website: "",
  facebook_url: "",
  description: "",
};

function PlacesPage() {
  const user = useCurrentUser();
  const search = Route.useSearch();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [myPantries, setMyPantries] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [active, setActive] = useState<Facility | null>(null);
  const [purpose, setPurpose] = useState("");
  const [dateOn, setDateOn] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(search.register === "1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [pantryFilter, setPantryFilter] = useState("");

  const reservable = facilities.filter((f) => !isPantry(f));

  // Every pantry on this board, not just the ones you added — this page is the
  // directory a neighbor opens when they need food this week.
  const pantryQuery = useMemo(() => parseQuery(pantryFilter), [pantryFilter]);
  const communityPantries = useMemo(() => {
    const rows = facilities.filter(isPantry);
    if (pantryQuery.isEmpty) return rows;
    return rows
      .map((p) => ({
        p,
        score: scoreFields(pantryQuery, [
          { text: p.name, weight: 3 },
          { text: "food pantry groceries", weight: 2 },
          { text: p.city, weight: 2 },
          { text: [p.address, p.zip].join(" "), weight: 2 },
          { text: [p.serve_days, p.serve_times].join(" "), weight: 1 },
          { text: [p.description, p.other_notes, p.residency_note].join(" "), weight: 1 },
        ]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.p);
  }, [facilities, pantryQuery]);

  // Your listings on OTHER boards still deserve a place to be corrected.
  const pantriesElsewhere = myPantries.filter(
    (p) => !facilities.some((f) => f.id === p.id),
  );

  async function reload(mid?: string) {
    const m = await getMyMemberships();
    setMemberships(m);
    const primary = m.find((x) => x.is_primary) ?? m[0];
    const id = mid || communityId || primary?.community_id || "";
    setCommunityId(id);
    const slug = m.find((x) => x.community_id === id)?.community?.slug;
    if (slug) {
      const feed = await getCommunityFeed({ data: { slug, userId: user?.id } });
      setFacilities(feed.facilities);
    }
    const [books, mine] = await Promise.all([listMyBookings(), listMyPantryListings()]);
    setBookings(books);
    setMyPantries(mine);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (search.register === "1") setShowForm(true);
  }, [search.register]);

  function patch<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(p: Facility) {
    setEditingId(p.id);
    setShowForm(true);
    setForm({
      name: p.name,
      address: p.address,
      city: p.city,
      zip: p.zip,
      serve_days: p.serve_days,
      serve_times: p.serve_times,
      residency_note: p.residency_note,
      visit_frequency: p.visit_frequency,
      id_docs: p.id_docs,
      other_notes: p.other_notes,
      phone: p.phone,
      website: p.website,
      facebook_url: p.facebook_url,
      description: p.description,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Places & pantries</h1>
          <p className="text-sm text-fg-muted">
            Request a pavilion or room — or add a Toombs / Vidalia food pantry listing
            neighbors can find. Pantries are not reservable rooms.
          </p>
        </div>
        <Button
          data-testid="add-pantry"
          onClick={() => {
            setShowForm((v) => !v);
            if (showForm) {
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
        >
          {showForm ? "Close" : "Add a pantry listing"}
        </Button>
      </div>

      {memberships.length > 1 && (
        <Select
          value={communityId}
          onValueChange={(v) => {
            setCommunityId(v);
            void reload(v);
          }}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memberships.map((m) => (
              <SelectItem key={m.community_id} value={m.community_id}>
                {m.community?.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showForm && (
        <form
          className="surface-card space-y-3 p-4"
          data-testid="pantry-register-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!communityId) {
              toast.error("Join a community first");
              return;
            }
            try {
              if (editingId) {
                await updatePantryListing({ data: { id: editingId, communityId, ...form } });
                toast.success("Pantry listing updated");
              } else {
                await createPantryListing({ data: { communityId, ...form } });
                toast.success("Pantry listed");
              }
              setShowForm(false);
              setEditingId(null);
              setForm(emptyForm);
              await reload(communityId);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <p className="text-sm text-fg-muted">
            Only add a pantry you can speak for. Hours and address must be real. We
            will not invent listings.
          </p>
          <div className="space-y-1.5">
            <Label>Pantry name</Label>
            <Input
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              placeholder="Church or agency pantry name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Street address</Label>
            <Input
              value={form.address}
              onChange={(e) => patch("address", e.target.value)}
              placeholder="123 Main St"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => patch("city", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input
                value={form.zip}
                onChange={(e) => patch("zip", e.target.value)}
                inputMode="numeric"
                placeholder="30474"
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Serve days</Label>
              <Input
                value={form.serve_days}
                onChange={(e) => patch("serve_days", e.target.value)}
                placeholder="2nd & 3rd Wednesday"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Serve times</Label>
              <Input
                value={form.serve_times}
                onChange={(e) => patch("serve_times", e.target.value)}
                placeholder="9:00am–3:00pm"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Residency / ZIP limits</Label>
            <Input
              value={form.residency_note}
              onChange={(e) => patch("residency_note", e.target.value)}
              placeholder="Toombs County residents, or none listed"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Visit frequency</Label>
              <Input
                value={form.visit_frequency}
                onChange={(e) => patch("visit_frequency", e.target.value)}
                placeholder="Once a month"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID / documents</Label>
              <Input
                value={form.id_docs}
                onChange={(e) => patch("id_docs", e.target.value)}
                placeholder="Photo ID and proof of address"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Other notes</Label>
            <Textarea
              value={form.other_notes}
              onChange={(e) => patch("other_notes", e.target.value)}
              placeholder="Call ahead, bring bags, interpreter available…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => patch("phone", e.target.value)}
                placeholder="912-555-0100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website (optional)</Label>
              <Input
                value={form.website}
                onChange={(e) => patch("website", e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Facebook page (optional)</Label>
            <Input
              value={form.facebook_url}
              onChange={(e) => patch("facebook_url", e.target.value)}
              placeholder="facebook.com/yourpantry"
            />
            <p className="text-xs text-fg-subtle">
              Worth adding even if there is no website — it is usually where a closure or a
              changed day gets announced first.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Short description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
              placeholder="What neighbors should know before they go"
            />
          </div>
          <Button type="submit">{editingId ? "Save pantry" : "Publish pantry listing"}</Button>
        </form>
      )}

      <section className="space-y-3" data-testid="pantry-directory">
        <h2 className="font-display text-lg font-semibold">Food pantries in this community</h2>
        <p className="text-sm text-fg-muted">
          Tap Drive to open Maps. Claim a listing to correct hours if you speak for that pantry.
        </p>
        <PantryMap pantries={communityPantries} />
        <Input
          value={pantryFilter}
          onChange={(e) => setPantryFilter(e.target.value)}
          data-testid="pantry-filter-input"
          aria-label="Search pantries"
          placeholder="Search pantries — Lyons, Wednesday, no ID needed…"
        />
        {communityPantries.length === 0 && (
          <p className="text-sm text-fg-muted">
            {facilities.filter(isPantry).length === 0
              ? "No pantry listings on this board yet. We did not seed invented hours — add or claim a real one."
              : `No pantry matches “${pantryFilter}”. Clear the box to see all of them.`}
          </p>
        )}
        {communityPantries.map((p) => {
          const mine = p.listed_by === user?.id;
          const publicRow = isPublicListing(p);
          return (
            <div key={p.id} className="surface-card p-4" data-testid={`pantry-card-${p.id}`}>
              <PantryDetails pantry={p} />
              {mine || publicRow ? (
                <Button
                  className="mt-3"
                  size="sm"
                  variant={mine ? "default" : "secondary"}
                  data-testid={mine ? `pantry-edit-${p.id}` : `pantry-claim-${p.id}`}
                  onClick={() => startEdit(p)}
                >
                  {mine ? "Update this listing" : "Claim & correct these hours"}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-fg-subtle">
                  Listed by {p.listed_by_name || "a neighbor"} — ask them to update it if
                  something here is wrong.
                </p>
              )}
            </div>
          );
        })}
        <p className="text-sm text-fg-muted">
          Church food assistance also lives on{" "}
          <a className="text-primary underline" href={CC_GET_HELP} target="_blank" rel="noreferrer">
            ChurchConnect Get Help
          </a>
          . Neighborly does not copy that directory.
        </p>
      </section>

      {pantriesElsewhere.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Your pantry listings elsewhere</h2>
          {pantriesElsewhere.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => startEdit(p)}
              className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
            >
              <PantryDetails pantry={p} compact />
              <p className="mt-2 text-xs text-fg-subtle">Tap to update</p>
            </button>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Reservable places</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {reservable.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActive(f);
                setPurpose("");
                setDateOn("");
                setTimeNote("");
              }}
              className="surface-card p-4 text-left transition-colors hover:border-border-strong"
            >
              <Badge variant="outline">Reservable</Badge>
              <h2 className="mt-2 font-medium">{f.name}</h2>
              <p className="mt-1 text-sm text-fg-muted">{f.description}</p>
              <p className="mt-2 text-xs text-fg-subtle">
                Capacity {f.capacity ?? "—"} · {f.rate_note}
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
        </div>
        {reservable.length === 0 && (
          <p className="text-sm text-fg-muted">No reservable rooms in this community yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your requests</h2>
        {bookings.length === 0 && (
          <p className="text-sm text-fg-muted">No facility requests yet — tap a reservable place above.</p>
        )}
        {bookings.map((b) => (
          <div key={b.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{b.facility_name}</p>
              <Badge variant={b.status === "requested" ? "accent" : "default"}>{b.status}</Badge>
            </div>
            <p className="text-sm text-fg-muted">
              {b.date_on}
              {b.time_note ? ` · ${b.time_note}` : ""} — {b.purpose}
            </p>
          </div>
        ))}
      </section>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Request {active.name}</DialogTitle>
                <DialogDescription>{active.rate_note}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Purpose</Label>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Kids birthday, family reunion…"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={dateOn} onChange={(e) => setDateOn(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input
                      value={timeNote}
                      onChange={(e) => setTimeNote(e.target.value)}
                      placeholder="Noon–4pm"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await requestFacility({
                        data: {
                          facilityId: active.id,
                          communityId: active.community_id,
                          purpose,
                          date_on: dateOn,
                          time_note: timeNote,
                        },
                      });
                      toast.success("Request submitted");
                      setActive(null);
                      await reload(communityId);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Submit request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
