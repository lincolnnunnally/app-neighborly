import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  getCommunityFeed,
  getMyMemberships,
  listMyBookings,
  requestFacility,
  type FacilityBooking,
} from "@/lib/community/server";
import type { Facility, Membership } from "@/lib/community/types";

export const Route = createFileRoute("/app/places")({
  component: PlacesPage,
});

function PlacesPage() {
  const user = useCurrentUser();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [active, setActive] = useState<Facility | null>(null);
  const [purpose, setPurpose] = useState("");
  const [dateOn, setDateOn] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [busy, setBusy] = useState(false);

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
    setBookings(await listMyBookings());
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Places & facilities</h1>
        <p className="text-sm text-fg-muted">
          Request the pavilion or multipurpose room for birthdays and gatherings.
        </p>
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

      <div className="grid gap-3 sm:grid-cols-2">
        {facilities.map((f) => (
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
            <h2 className="font-medium">{f.name}</h2>
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

      {facilities.length === 0 && (
        <p className="text-sm text-fg-muted">No facilities in this community yet.</p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your requests</h2>
        {bookings.length === 0 && (
          <p className="text-sm text-fg-muted">No facility requests yet — tap a place above.</p>
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
