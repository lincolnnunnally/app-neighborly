import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMyMemberships } from "@/lib/community/server";
import {
  confirmToolReturn,
  createTool,
  getToolPaymentsReady,
  listMyToolBookings,
  listMyTools,
  listToolBookingMessages,
  messageToolBooking,
  reportToolIssue,
  setToolStatus,
} from "@/lib/community/tools-server";
import { dollarsToCents, formatCents } from "@/lib/community/payments";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  toolCategoryLabel,
  toolConditionLabel,
  type Membership,
  type Tool,
  type ToolBooking,
  type ToolMessage,
} from "@/lib/community/types";

type ToolsSearch = { register?: string };

export const Route = createFileRoute("/app/tools")({
  validateSearch: (s: Record<string, unknown>): ToolsSearch => ({
    register: typeof s.register === "string" ? s.register : undefined,
  }),
  component: ToolsPage,
});

function ToolsPage() {
  const user = useCurrentUser();
  const search = Route.useSearch();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [bookings, setBookings] = useState<ToolBooking[]>([]);
  const [payNote, setPayNote] = useState("Payments coming soon — booking reserved");
  const [payLive, setPayLive] = useState(false);
  const [showForm, setShowForm] = useState(search.register === "1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("lawn");
  const [condition, setCondition] = useState("good");
  const [dailyDollars, setDailyDollars] = useState("25");
  const [replaceDollars, setReplaceDollars] = useState("200");
  const [photoUrls, setPhotoUrls] = useState("");
  const [streetHint, setStreetHint] = useState("");
  const [runsReady, setRunsReady] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [thread, setThread] = useState<ToolMessage[]>([]);
  const [reply, setReply] = useState("");
  const [issueNote, setIssueNote] = useState("");

  async function reload() {
    const [m, mine, books, pay] = await Promise.all([
      getMyMemberships(),
      listMyTools(),
      listMyToolBookings(),
      getToolPaymentsReady(),
    ]);
    setMemberships(m);
    setTools(mine);
    setBookings(books);
    setPayNote(pay.message);
    setPayLive(pay.live);
    const primary = m.find((x) => x.is_primary) ?? m[0];
    setCommunityId((id) => id || primary?.community_id || "");
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (search.register === "1") setShowForm(true);
  }, [search.register]);

  const incoming = bookings.filter((b) => b.owner_user_id === user?.id);
  const outgoing = bookings.filter((b) => b.borrower_user_id === user?.id);

  async function openThread(id: string) {
    setThreadId(id);
    setThread(await listToolBookingMessages({ data: id }));
    setReply("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tools to borrow</h1>
          <p className="text-sm text-fg-muted">
            List a mower, welder, trailer, or other physical tool. Neighbors book dates
            and arrange pickup here. Services stay for skill and labor — this is inventory.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "List a tool"}
        </Button>
      </div>

      <p
        className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-3 py-2 text-sm text-fg-muted"
        data-testid="tools-payments-banner"
      >
        {payLive ? payNote : "Payments coming soon — booking reserved. Meetup still works."}
      </p>

      {memberships.length > 1 && (
        <Select value={communityId} onValueChange={setCommunityId}>
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
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createTool({
                data: {
                  communityId,
                  title,
                  description,
                  category,
                  condition,
                  photo_urls: photoUrls
                    .split(/\n|,/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                  daily_rate_cents: dollarsToCents(dailyDollars),
                  replacement_value_cents: dollarsToCents(replaceDollars),
                  runs_ready: runsReady,
                  street_hint: streetHint,
                },
              });
              toast.success("Tool listed");
              setShowForm(false);
              setTitle("");
              setDescription("");
              setPhotoUrls("");
              setRunsReady(false);
              await reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Tool title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Honda push mower, 20-ft trailer, pressure washer…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it is, fuel, what it does well, pickup notes…"
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
                  {TOOL_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_CONDITIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Daily rate ($)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={dailyDollars}
                onChange={(e) => setDailyDollars(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Replacement value ($)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={replaceDollars}
                onChange={(e) => setReplaceDollars(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pickup area hint</Label>
            <Input
              value={streetHint}
              onChange={(e) => setStreetHint(e.target.value)}
              placeholder="Near the high school — no full address required"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Photo URLs (optional, one per line)</Label>
            <Textarea
              value={photoUrls}
              onChange={(e) => setPhotoUrls(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={runsReady} onCheckedChange={(v) => setRunsReady(Boolean(v))} />
            It runs and is ready to lend (required)
          </label>
          <Button type="submit">Publish tool</Button>
        </form>
      )}

      <BookingList
        title="Borrows of your tools"
        empty="No one has reserved your tools yet."
        bookings={incoming}
        userId={user?.id}
        onOpen={openThread}
        onReload={reload}
        issueNote={issueNote}
        setIssueNote={setIssueNote}
      />
      <BookingList
        title="Your borrow requests"
        empty="You have not reserved a neighbor's tool yet."
        bookings={outgoing}
        userId={user?.id}
        onOpen={openThread}
        onReload={reload}
        issueNote={issueNote}
        setIssueNote={setIssueNote}
      />

      {threadId && (
        <section className="surface-card space-y-3 p-4">
          <h2 className="font-display text-lg font-semibold">Meetup notes</h2>
          {thread.map((m) => (
            <p key={m.id} className="text-sm">
              <span className="font-medium">{m.author_name}</span>
              <span className="text-fg-muted"> — {m.message}</span>
            </p>
          ))}
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Pickup time, return spot, gas can, etc."
          />
          <Button
            size="sm"
            onClick={async () => {
              try {
                await messageToolBooking({ data: { bookingId: threadId, message: reply } });
                setReply("");
                setThread(await listToolBookingMessages({ data: threadId }));
                await reload();
                toast.success("Note sent");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            Send meetup note
          </Button>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <article key={t.id} className="surface-card p-4">
            {t.photo_urls[0] ? (
              <img
                src={t.photo_urls[0]}
                alt=""
                className="mb-3 h-36 w-full rounded-[var(--radius-md)] object-cover"
              />
            ) : null}
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{toolCategoryLabel(t.category)}</Badge>
              <Badge variant="outline">{toolConditionLabel(t.condition)}</Badge>
              <Badge>{t.status}</Badge>
            </div>
            <h2 className="font-medium">{t.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{t.description}</p>
            <p className="mt-2 text-xs text-fg-subtle">
              {formatCents(t.daily_rate_cents)}/day · deposit {formatCents(t.replacement_value_cents)}
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await setToolStatus({
                    data: { toolId: t.id, status: t.status === "listed" ? "paused" : "listed" },
                  });
                  await reload();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              {t.status === "listed" ? "Pause listing" : "Relist"}
            </Button>
          </article>
        ))}
      </div>
      {tools.length === 0 && !showForm && (
        <p className="text-sm text-fg-muted">No tools listed yet. List a tool neighbors can borrow.</p>
      )}
    </div>
  );
}

function BookingList({
  title,
  empty,
  bookings,
  userId,
  onOpen,
  onReload,
  issueNote,
  setIssueNote,
}: {
  title: string;
  empty: string;
  bookings: ToolBooking[];
  userId?: string;
  onOpen: (id: string) => void;
  onReload: () => Promise<void>;
  issueNote: string;
  setIssueNote: (v: string) => void;
}) {
  if (bookings.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-fg-muted">{empty}</p>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {bookings.map((b) => (
        <article key={b.id} className="surface-card space-y-2 p-4">
          <p className="text-sm font-medium">
            {b.borrower_name} · “{b.tool_title}”
          </p>
          <p className="text-xs text-fg-muted">
            {b.start_date} → {b.end_date} ({b.days} day{b.days === 1 ? "" : "s"}) · {b.status} ·{" "}
            {b.payment_status === "coming_soon"
              ? "Payments coming soon — booking reserved"
              : b.payment_status}
          </p>
          <p className="text-xs text-fg-subtle">
            Rental {formatCents(b.rental_cents)} · owner {formatCents(b.owner_payout_cents)} · fee{" "}
            {formatCents(b.platform_fee_cents)} · deposit {formatCents(b.deposit_cents)}
          </p>
          {b.meetup_note ? <p className="text-sm text-fg-muted">{b.meetup_note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onOpen(b.id)}>
              Meetup notes
            </Button>
            {b.status !== "returned" && b.status !== "cancelled" && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const res = await confirmToolReturn({ data: { bookingId: b.id } });
                    toast.success(
                      res.status === "returned"
                        ? "Both sides confirmed — deposit released when Stripe is live"
                        : "Return noted. Waiting on the other neighbor.",
                    );
                    await onReload();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Confirm return
              </Button>
            )}
          </div>
          {b.status !== "returned" && b.status !== "cancelled" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder="Damage, late, or missing…"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await reportToolIssue({
                      data: {
                        bookingId: b.id,
                        damage_note: issueNote,
                        capture_deposit: b.owner_user_id === userId,
                      },
                    });
                    toast.message("Dispute noted. Admin review can add a note later.");
                    setIssueNote("");
                    await onReload();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Report issue
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
