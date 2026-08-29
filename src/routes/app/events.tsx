import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  cancelRsvp,
  createEvent,
  getCommunityFeed,
  getMyMemberships,
  rsvpEvent,
} from "@/lib/community/server";
import {
  EVENT_KINDS,
  type CommunityEvent,
  type Membership,
} from "@/lib/community/types";
import { formatEventWhen } from "@/lib/utils";
import { ReportBlockControls } from "@/components/safety/report-block";

export const Route = createFileRoute("/app/events")({
  component: EventsPage,
});

function EventsPage() {
  const user = useCurrentUser();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("social");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [active, setActive] = useState<CommunityEvent | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(mid?: string) {
    const m = await getMyMemberships();
    setMemberships(m);
    const primary = m.find((x) => x.is_primary) ?? m[0];
    const id = mid || communityId || primary?.community_id || "";
    setCommunityId(id);
    const slug = m.find((x) => x.community_id === id)?.community?.slug;
    if (!slug) return;
    const feed = await getCommunityFeed({ data: { slug, userId: user?.id } });
    setEvents(feed.events);
    if (active) {
      setActive(feed.events.find((e) => e.id === active.id) ?? null);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Events & gatherings</h1>
          <p className="text-sm text-fg-muted">
            Tap an event to RSVP. Host your own block party or cleanup.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Host an event"}
        </Button>
      </div>

      {showForm && (
        <form
          className="surface-card space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createEvent({
                data: {
                  communityId,
                  title,
                  description,
                  kind,
                  location,
                  starts_at: new Date(startsAt).toISOString(),
                },
              });
              toast.success("Event created");
              setShowForm(false);
              setTitle("");
              await reload(communityId);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KINDS.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Street, park, pavilion…"
            />
          </div>
          <Button type="submit">Publish event</Button>
        </form>
      )}

      <div className="space-y-3">
        {events.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActive(e)}
            className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="sky">{e.kind}</Badge>
              {e.has_rsvp && <Badge>Going</Badge>}
              <span className="text-xs text-fg-muted">{formatEventWhen(e.starts_at)}</span>
            </div>
            <h2 className="font-medium">{e.title}</h2>
            <p className="line-clamp-2 text-sm text-fg-muted">{e.description}</p>
            <p className="mt-2 text-xs text-fg-subtle">
              {e.location} · hosted by {e.host_name} · {e.rsvp_count} going · tap to open
            </p>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
                <DialogDescription>
                  {formatEventWhen(active.starts_at)} · {active.kind}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{active.description}</p>
              <p className="text-sm text-fg-muted">
                {active.location} · {active.rsvp_count} going · {active.host_name}
              </p>
              {active.user_id !== user?.id && (
                <ReportBlockControls
                  contentType="event"
                  contentId={active.id}
                  reportedUserId={active.user_id}
                  reportedUserName={active.host_name}
                  contentExcerpt={active.title}
                  allowBlock
                  onBlocked={() => {
                    setActive(null);
                    void reload(communityId);
                  }}
                />
              )}
              <DialogFooter>
                <Button variant="secondary" onClick={() => setActive(null)}>
                  Close
                </Button>
                {active.has_rsvp ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await cancelRsvp({ data: active.id });
                        toast.success("RSVP cancelled");
                        await reload(communityId);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
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
                        await rsvpEvent({ data: active.id });
                        toast.success("You're going. The gathering is the win — not this screen.");
                        await reload(communityId);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    RSVP
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
