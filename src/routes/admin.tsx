import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, HandHeart, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOwnerDashboard } from "@/lib/admin-stats";
import {
  getConnectionPulse,
  ownerCreateEvent,
  ownerCreateIssue,
  ownerCreateServeNeed,
  ownerUpdateIssue,
  type CommunityPulse,
  type ConnectionPulse,
  type SiblingPulse,
} from "@/lib/community/ops";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatEventWhen } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const CALENDARS = [
  {
    name: "Visit Vidalia events",
    url: "https://visitvidaliaga.com/things-to-do/events/",
    note: "City tourism calendar — onion festival, parades, downtown.",
  },
  {
    name: "First Baptist Vidalia",
    url: "https://fbcvidalia.com/events",
    note: "Pickleball, Celebrate Recovery, GriefShare — confirm before listing.",
  },
  {
    name: "Vidalia Parks & Rec",
    url: "https://vidaliaga.gov/departments/parks-and-recreation/",
    note: "Fields, Dixon Building, Rec1 registration.",
  },
  {
    name: "Kindred event curation",
    url: "https://kindred.unitedundergod.org/admin/events/curate",
    note: "Friendship-side listings. Do not invent gatherings.",
  },
];

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return String(value);
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState<string | null>(null);
  const [gate, setGate] = useState<"loading" | "signed_out" | "forbidden" | "ok">("loading");
  const [pulse, setPulse] = useState<ConnectionPulse | null>(null);
  const [busy, setBusy] = useState(false);

  const [eventForm, setEventForm] = useState({
    communityId: "",
    title: "",
    location: "",
    starts_at: "",
    description: "",
  });
  const [serveForm, setServeForm] = useState({
    communityId: "",
    orgType: "church",
    orgName: "",
    title: "",
    whenNote: "",
    whereNote: "",
    description: "",
  });
  const [issueForm, setIssueForm] = useState({ title: "", body: "", source_app: "neighborly" });

  async function reload() {
    const [dash, next] = await Promise.all([getOwnerDashboard(), getConnectionPulse()]);
    if (dash.status === "signed_out" || next.status === "signed_out") {
      setGate("signed_out");
      return;
    }
    if (dash.status === "forbidden" || next.status === "forbidden") {
      setGate("forbidden");
      setEmail(dash.status === "forbidden" ? dash.email : next.status === "forbidden" ? next.email : null);
      return;
    }
    setGate("ok");
    setEmail(next.email);
    setPulse(next.pulse);
    const vidalia = next.pulse.communities.find((c) => c.slug === "vidalia") ?? next.pulse.communities[0];
    if (vidalia) {
      setEventForm((f) => ({ ...f, communityId: f.communityId || vidalia.id }));
      setServeForm((f) => ({ ...f, communityId: f.communityId || vidalia.id }));
    }
  }

  useEffect(() => {
    if (isPending) return;
    reload().catch(() => setGate("signed_out"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, user?.id]);

  async function onCreateEvent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await ownerCreateEvent({ data: eventForm });
      toast.success("Gathering is on the board");
      setEventForm((f) => ({ ...f, title: "", location: "", starts_at: "", description: "" }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add gathering");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateServe(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await ownerCreateServeNeed({ data: serveForm });
      if (res.lomPosted) {
        toast.success("Posted on Neighborly and Live On Mission");
      } else {
        toast.message("Posted on Neighborly. Live On Mission did not take the row.");
        if (res.lomError) toast.error(res.lomError);
      }
      setServeForm((f) => ({ ...f, orgName: "", title: "", whenNote: "", whereNote: "", description: "" }));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post volunteer request");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateIssue(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await ownerCreateIssue({ data: issueForm });
      toast.success("Issue logged");
      setIssueForm({ title: "", body: "", source_app: "neighborly" });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log issue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-5xl space-y-8 py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Owner door
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">
            Connection ops — Vidalia
          </h1>
          <p className="mt-2 max-w-2xl text-fg-muted">
            See what is actually happening, add gatherings, take volunteer requests from
            churches, schools, and civic groups, and work issues. Empty is empty. This is
            not a new hub — each app still owns its people.
          </p>
        </div>

        {isPending || gate === "loading" ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />
        ) : gate === "signed_out" ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in as the owner</CardTitle>
              <CardDescription>
                Counts and posting only work after you sign in with the owner account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/login" search={{ redirect: "/admin" }}>
                  Sign in
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : gate === "forbidden" ? (
          <Card>
            <CardHeader>
              <CardTitle>Not the owner door</CardTitle>
              <CardDescription>
                Signed in as {email ?? "this account"}. Only Lincoln can run this desk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary">
                <Link to="/app">Back to my hub</Link>
              </Button>
            </CardContent>
          </Card>
        ) : pulse ? (
          <>
            <p className="text-sm text-fg-subtle">Signed in as {email}</p>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Neighborly boards</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {pulse.communities.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Sister apps</h2>
              <p className="text-sm text-fg-muted">
                One shared Life Produces Life database, many table families. A dash means
                this desk cannot see that table — open the app that owns it.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pulse.siblings.map((s) => (
                  <SiblingCard key={s.id} sibling={s} />
                ))}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add a gathering</CardTitle>
                  <CardDescription>
                    Lands on the Neighborly board. Use public listings only when they are real.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={(e) => void onCreateEvent(e)}>
                    <CommunitySelect
                      communities={pulse.communities}
                      value={eventForm.communityId}
                      onChange={(communityId) => setEventForm((f) => ({ ...f, communityId }))}
                    />
                    <Field label="Title">
                      <Input
                        required
                        value={eventForm.title}
                        onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Saturday pickleball"
                      />
                    </Field>
                    <Field label="When">
                      <Input
                        required
                        type="datetime-local"
                        value={eventForm.starts_at}
                        onChange={(e) => setEventForm((f) => ({ ...f, starts_at: e.target.value }))}
                      />
                    </Field>
                    <Field label="Where">
                      <Input
                        value={eventForm.location}
                        onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Rec Complex, 102 Stockyard Rd"
                      />
                    </Field>
                    <Field label="Notes">
                      <Textarea
                        value={eventForm.description}
                        onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                      />
                    </Field>
                    <Button type="submit" disabled={busy}>
                      Post gathering
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Volunteer request</CardTitle>
                  <CardDescription>
                    Church, school, government, or civic group. People who want to serve
                    can find this on the Vidalia board. We also try Live On Mission.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={(e) => void onCreateServe(e)}>
                    <CommunitySelect
                      communities={pulse.communities}
                      value={serveForm.communityId}
                      onChange={(communityId) => setServeForm((f) => ({ ...f, communityId }))}
                    />
                    <Field label="Who is asking">
                      <select
                        className="flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                        value={serveForm.orgType}
                        onChange={(e) => setServeForm((f) => ({ ...f, orgType: e.target.value }))}
                      >
                        <option value="church">Church</option>
                        <option value="school">School</option>
                        <option value="government">Government / city</option>
                        <option value="nonprofit">Nonprofit</option>
                        <option value="neighbor">Neighbor / civic group</option>
                      </select>
                    </Field>
                    <Field label="Organization name">
                      <Input
                        required
                        value={serveForm.orgName}
                        onChange={(e) => setServeForm((f) => ({ ...f, orgName: e.target.value }))}
                        placeholder="First Baptist Vidalia"
                      />
                    </Field>
                    <Field label="The need">
                      <Input
                        required
                        value={serveForm.title}
                        onChange={(e) => setServeForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Pack weekend food bags"
                      />
                    </Field>
                    <Field label="When">
                      <Input
                        value={serveForm.whenNote}
                        onChange={(e) => setServeForm((f) => ({ ...f, whenNote: e.target.value }))}
                        placeholder="Thursday 6pm, or this Saturday morning"
                      />
                    </Field>
                    <Field label="Where">
                      <Input
                        value={serveForm.whereNote}
                        onChange={(e) => setServeForm((f) => ({ ...f, whereNote: e.target.value }))}
                        placeholder="Gym, school cafeteria, city park"
                      />
                    </Field>
                    <Field label="Details">
                      <Textarea
                        value={serveForm.description}
                        onChange={(e) => setServeForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                      />
                    </Field>
                    <Button type="submit" disabled={busy}>
                      Post volunteer request
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Issues</CardTitle>
                  <CardDescription>Work list. Not a second product tracker.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form className="space-y-3" onSubmit={(e) => void onCreateIssue(e)}>
                    <Field label="Issue">
                      <Input
                        required
                        value={issueForm.title}
                        onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Need a second pickleball host"
                      />
                    </Field>
                    <Field label="Notes">
                      <Textarea
                        value={issueForm.body}
                        onChange={(e) => setIssueForm((f) => ({ ...f, body: e.target.value }))}
                        rows={2}
                      />
                    </Field>
                    <Field label="App">
                      <select
                        className="flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                        value={issueForm.source_app}
                        onChange={(e) => setIssueForm((f) => ({ ...f, source_app: e.target.value }))}
                      >
                        <option value="neighborly">Neighborly</option>
                        <option value="knd">Kids Need Dads</option>
                        <option value="kindred">Kindred</option>
                        <option value="lom">Live On Mission</option>
                        <option value="aligned">Aligned Souls</option>
                        <option value="presence">Presence</option>
                      </select>
                    </Field>
                    <Button type="submit" disabled={busy} variant="secondary">
                      Log issue
                    </Button>
                  </form>
                  <ul className="space-y-2">
                    {pulse.issues.length === 0 ? (
                      <li className="text-sm text-fg-muted">No issues yet.</li>
                    ) : (
                      pulse.issues.map((iss) => (
                        <li key={iss.id} className="rounded-[var(--radius-md)] border border-border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={iss.status === "done" ? "secondary" : "accent"}>
                              {iss.status}
                            </Badge>
                            <span className="text-xs text-fg-subtle">{iss.source_app}</span>
                          </div>
                          <p className="mt-1 font-medium">{iss.title}</p>
                          {iss.body ? <p className="text-sm text-fg-muted">{iss.body}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {iss.status !== "doing" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void ownerUpdateIssue({ data: { id: iss.id, status: "doing" } })
                                    .then(reload)
                                    .catch((err) => toast.error(String(err)))
                                }
                              >
                                Doing
                              </Button>
                            )}
                            {iss.status !== "done" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  void ownerUpdateIssue({ data: { id: iss.id, status: "done" } })
                                    .then(reload)
                                    .catch((err) => toast.error(String(err)))
                                }
                              >
                                Done
                              </Button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Calendars we can draw from</CardTitle>
                  <CardDescription>
                    Live iCal/Google sync is not wired (that needs calendar credentials).
                    These public calendars are real. Copy a listing into Add a gathering.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CALENDARS.map((cal) => (
                    <a
                      key={cal.url}
                      href={cal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[var(--radius-md)] border border-border p-3 no-underline hover:border-border-strong"
                    >
                      <p className="font-medium text-fg">{cal.name}</p>
                      <p className="text-sm text-fg-muted">{cal.note}</p>
                    </a>
                  ))}
                </CardContent>
              </Card>
            </div>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming gatherings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pulse.upcomingEvents.length === 0 ? (
                    <p className="text-sm text-fg-muted">None yet.</p>
                  ) : (
                    pulse.upcomingEvents.map((ev) => (
                      <div key={ev.id} className="rounded-[var(--radius-md)] border border-border p-3">
                        <p className="font-medium">{ev.title}</p>
                        <p className="text-xs text-fg-muted">
                          {ev.community} · {formatEventWhen(ev.starts_at)} · {ev.rsvp_count} going
                        </p>
                        <p className="text-xs text-fg-subtle">
                          {ev.location || "Location TBA"} · {ev.host_name}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Volunteer requests on the board</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pulse.serveNeeds.length === 0 ? (
                    <p className="text-sm text-fg-muted">None posted yet.</p>
                  ) : (
                    pulse.serveNeeds.map((n) => (
                      <div key={n.id} className="rounded-[var(--radius-md)] border border-border p-3">
                        <p className="font-medium">{n.title}</p>
                        <p className="text-xs text-fg-muted">
                          {n.community} · {n.author_name} · {n.status}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
          <a href="https://liveonmission.unitedundergod.org/admin-ops" className="hover:text-fg">
            Live On Mission ops
          </a>
          <a href="https://kindred.unitedundergod.org/admin" className="hover:text-fg">
            Kindred admin
          </a>
          <a href="https://churchconnect.unitedundergod.org" className="hover:text-fg">
            ChurchConnect
          </a>
          <a href="https://appengine.unitedundergod.org/help?app=neighborly" className="hover:text-fg">
            Help form
          </a>
          <Link to="/" className="hover:text-fg">
            Back home
          </Link>
        </div>
      </main>
    </div>
  );
}

function CommunityCard({ community: c }: { community: CommunityPulse }) {
  return (
    <Link
      to="/c/$slug"
      params={{ slug: c.slug }}
      className="surface-card block p-5 no-underline transition-colors hover:border-border-strong"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold text-fg">{c.name}</h3>
        <Badge variant="secondary">{c.city || "—"}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-fg-muted">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {c.members} people
        </span>
        <span className="flex items-center gap-1">
          <HandHeart className="h-3.5 w-3.5" /> {c.openNeeds} open needs
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" /> {c.events} gatherings
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {c.rsvps} RSVPs · {c.serveNeeds} serve
        </span>
      </div>
    </Link>
  );
}

function SiblingCard({ sibling: s }: { sibling: SiblingPulse }) {
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noreferrer"
      className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
    >
      <p className="font-medium text-fg">{s.label}</p>
      {s.visible ? (
        <p className="mt-1 text-sm text-fg-muted">
          {s.people !== null ? `${s.people} people` : "People live in that app"}
          {s.gatherings !== null ? ` · ${s.gatherings} gatherings` : ""}
          {s.extra !== null ? ` · ${s.extraLabel}: ${s.extra}` : s.extraLabel ? ` · ${s.extraLabel}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-sm text-fg-muted">
          Not visible from this schema — open {s.label} to see live counts.
        </p>
      )}
    </a>
  );
}

function CommunitySelect({
  communities,
  value,
  onChange,
}: {
  communities: CommunityPulse[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label="Community">
      <select
        className="flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
