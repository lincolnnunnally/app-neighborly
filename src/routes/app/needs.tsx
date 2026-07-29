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
import { Checkbox } from "@/components/ui/checkbox";
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
  acceptHelpOffer,
  createNeed,
  getCommunityFeed,
  getMyMemberships,
  listMyIncomingOffers,
  listOffersForNeed,
  markNeedDone,
  offerHelp,
  type HelpOffer,
} from "@/lib/community/server";
import { NEED_CATEGORIES, type Membership, type Need } from "@/lib/community/types";

export const Route = createFileRoute("/app/needs")({
  component: NeedsPage,
});

function NeedsPage() {
  const user = useCurrentUser();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [needs, setNeeds] = useState<Need[]>([]);
  const [incoming, setIncoming] = useState<HelpOffer[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("household");
  const [urgency, setUrgency] = useState("normal");
  const [isPaid, setIsPaid] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState<Need | null>(null);
  const [offers, setOffers] = useState<HelpOffer[]>([]);
  const [helpMessage, setHelpMessage] = useState("I can help with this.");
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
      setNeeds(feed.needs);
    }
    setIncoming(await listMyIncomingOffers());
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function openNeed(n: Need) {
    setActive(n);
    setHelpMessage("I can help with this.");
    setOffers(await listOffersForNeed({ data: n.id }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Neighbor needs</h1>
          <p className="text-sm text-fg-muted">
            Post what you need — open a card to help or accept offers.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close form" : "Post a need"}
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
            <SelectValue placeholder="Community" />
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

      {incoming.filter((o) => o.status === "offered").length > 0 && (
        <section className="space-y-2 rounded-[var(--radius-xl)] border border-accent/30 bg-accent-soft/30 p-4">
          <h2 className="font-medium text-fg">Help offered to you</h2>
          {incoming
            .filter((o) => o.status === "offered")
            .map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {o.helper_name} → {o.need_title}
                  </p>
                  <p className="text-xs text-fg-muted">{o.message || "No message"}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await acceptHelpOffer({ data: { offerId: o.id } });
                      toast.success(`Accepted ${o.helper_name}`);
                      await reload(communityId);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Accept help
                </Button>
              </div>
            ))}
        </section>
      )}

      {showForm && (
        <form
          className="surface-card space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createNeed({
                data: {
                  communityId,
                  title,
                  description,
                  category,
                  urgency,
                  is_paid: isPaid,
                },
              });
              toast.success("Need posted");
              setTitle("");
              setDescription("");
              setShowForm(false);
              await reload(communityId);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>What do you need?</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Help hanging a ceiling fan"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Timing, tools needed, accessibility notes…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEED_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="soon">Soon</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPaid} onCheckedChange={(v) => setIsPaid(Boolean(v))} />
            Willing to pay or trade
          </label>
          <Button type="submit">Publish need</Button>
        </form>
      )}

      <div className="space-y-3">
        {needs.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => void openNeed(n)}
            className="surface-card w-full p-4 text-left transition-colors hover:border-border-strong"
          >
            <div className="mb-2 flex flex-wrap gap-2">
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
              {n.is_paid && <Badge variant="sky">paid/trade</Badge>}
              <Badge variant={n.status === "open" ? "default" : "secondary"}>{n.status}</Badge>
              {n.user_id === user?.id && <Badge variant="accent">Yours</Badge>}
            </div>
            <h2 className="font-medium">{n.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{n.description}</p>
            <p className="mt-3 text-xs text-fg-subtle">
              {n.author_name} · {n.help_count ?? 0} offers · tap to open
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
                  {active.author_name} · {active.status} · {active.urgency}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-fg">{active.description}</p>

              {offers.length > 0 && (
                <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
                  <p className="text-xs font-medium text-fg-muted">Offers</p>
                  {offers.map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-col gap-2 border-b border-border pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {o.helper_name}{" "}
                          <span className="font-normal text-fg-muted">· {o.status}</span>
                        </p>
                        <p className="text-xs text-fg-muted">{o.message}</p>
                      </div>
                      {active.user_id === user?.id && o.status === "offered" && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await acceptHelpOffer({ data: { offerId: o.id } });
                            toast.success("Helper accepted");
                            setOffers(await listOffersForNeed({ data: active.id }));
                            await reload(communityId);
                          }}
                        >
                          Accept
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {active.user_id === user?.id ? (
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setActive(null)}>
                    Close
                  </Button>
                  {active.status !== "done" && (
                    <Button
                      onClick={async () => {
                        await markNeedDone({ data: active.id });
                        toast.success("Marked done");
                        setActive(null);
                        await reload(communityId);
                      }}
                    >
                      Mark done
                    </Button>
                  )}
                </DialogFooter>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Message</Label>
                    <Textarea
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setActive(null)}>
                      Close
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await offerHelp({
                            data: { needId: active.id, message: helpMessage },
                          });
                          toast.success(res.already ? "Already offered" : "Offer sent");
                          setOffers(await listOffersForNeed({ data: active.id }));
                          await reload(communityId);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      I can help
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
