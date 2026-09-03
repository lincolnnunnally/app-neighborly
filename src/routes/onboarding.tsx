import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ChipSelect } from "@/components/community/chip-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMyMemberships,
  getMyProfile,
  joinCommunities,
  listCommunities,
  resolveInvite,
  upsertProfile,
} from "@/lib/community/server";
import {
  AVAILABILITY_OPTIONS,
  FAITH_POSTURE_OPTIONS,
  INTEREST_OPTIONS,
  KIND_LABELS,
  LIFE_SEASON_OPTIONS,
  SKILL_OPTIONS,
  type Community,
} from "@/lib/community/types";
import { recommendNextSteps, suggestedCommunitySlugs } from "@/lib/community/recommendations";
import { cn } from "@/lib/utils";

type OnboardingSearch = { community?: string; code?: string };

export const Route = createFileRoute("/onboarding")({
  validateSearch: (s: Record<string, unknown>): OnboardingSearch => ({
    community: typeof s.community === "string" ? s.community : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const bootstrapped = useRef(false);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | undefined>();
  const [inviteCode, setInviteCode] = useState(search.code ?? "");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [streetHint, setStreetHint] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [lifeSeason, setLifeSeason] = useState("");
  const [faithPosture, setFaithPosture] = useState("");
  const [hopingFor, setHopingFor] = useState("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(
    () => search.code === "VIDALIA-WELCOME" || search.community === "vidalia",
  );
  const [isYouth, setIsYouth] = useState(false);
  const [notifyEvents, setNotifyEvents] = useState(true);
  const [notifyNeeds, setNotifyNeeds] = useState(true);
  const [notifyServices, setNotifyServices] = useState(true);
  const [notifyFacilities, setNotifyFacilities] = useState(false);

  useEffect(() => {
    if (user?.displayName) setDisplayName((n) => n || user.displayName || "");
  }, [user]);

  useEffect(() => {
    if (!user || bootstrapped.current) return;
    bootstrapped.current = true;

    void (async () => {
      try {
        const [comms, profile, memberships] = await Promise.all([
          listCommunities(),
          getMyProfile(),
          getMyMemberships(),
        ]);
        setCommunities(comms);
        if (memberships.length > 0 && profile) {
          await navigate({ to: "/app" });
          return;
        }
        if (profile) {
          setDisplayName(profile.display_name);
          setBio(profile.bio);
          setStreetHint(profile.street_hint);
          setPhone(profile.phone);
          setSkills(profile.skills);
          setInterests(profile.interests);
          setLifeSeason(profile.life_season);
          setFaithPosture(profile.faith_posture);
          setHopingFor(profile.hoping_for);
          setAvailability(profile.availability);
          setIsNew(profile.is_new_resident);
          setIsYouth(profile.is_youth);
          setNotifyEvents(profile.notify_events);
          setNotifyNeeds(profile.notify_needs);
          setNotifyServices(profile.notify_services);
          setNotifyFacilities(profile.notify_facilities);
        }

        const preselect: string[] = [];
        if (search.code) {
          const inv = await resolveInvite({ data: search.code });
          if (inv?.community) preselect.push(inv.community.id);
        }
        if (search.community) {
          const match = comms.find((c) => c.slug === search.community);
          if (match && !preselect.includes(match.id)) preselect.push(match.id);
        }
        if (preselect.length === 0) {
          const vidalia = comms.find((c) => c.slug === "vidalia");
          const milstead = comms.find((c) => c.slug === "milstead");
          if (vidalia) preselect.push(vidalia.id);
          else if (milstead) preselect.push(milstead.id);
        }
        setSelected(preselect);
        setPrimaryId(preselect[0]);
      } catch {
        /* stay on form */
      }
    })();
  }, [user, search.code, search.community, navigate]);

  const selectedCommunities = useMemo(
    () => communities.filter((c) => selected.includes(c.id)),
    [communities, selected],
  );

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg p-6">
        <div className="h-10 w-40 animate-pulse rounded-full bg-bg-subtle" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn to="/signup" />;

  function profilePayload() {
    return {
      display_name: displayName.trim(),
      bio,
      phone,
      street_hint: streetHint,
      skills,
      help_offerings: skills,
      interests,
      life_season: lifeSeason,
      faith_posture: faithPosture,
      hoping_for: hopingFor,
      availability,
      is_new_resident: isNew,
      is_youth: isYouth,
      notify_events: notifyEvents,
      notify_needs: notifyNeeds,
      notify_services: notifyServices,
      notify_facilities: notifyFacilities,
    };
  }

  async function saveProfileAndContinue() {
    if (!displayName.trim()) {
      toast.error("Add a display name so neighbors know who you are");
      return;
    }
    setBusy(true);
    try {
      await upsertProfile({ data: profilePayload() });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  function applySuggestedAndContinue() {
    const slugs = suggestedCommunitySlugs({ life_season: lifeSeason, interests });
    const ids = communities.filter((c) => slugs.includes(c.slug)).map((c) => c.id);
    setSelected((prev) => [...new Set([...prev, ...ids])]);
    if (!primaryId && ids[0]) setPrimaryId(ids[0]);
    void (async () => {
      setBusy(true);
      try {
        await upsertProfile({ data: profilePayload() });
        setStep(3);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function applyInviteCode() {
    if (!inviteCode.trim()) return;
    try {
      const inv = await resolveInvite({ data: inviteCode.trim() });
      if (!inv) {
        toast.error("That invite code was not found");
        return;
      }
      setSelected((prev) =>
        prev.includes(inv.community.id) ? prev : [...prev, inv.community.id],
      );
      setPrimaryId((p) => p ?? inv.community.id);
      toast.success(`Added ${inv.community.name}`);
    } catch {
      toast.error("Could not resolve invite");
    }
  }

  async function finish() {
    if (selected.length === 0) {
      toast.error("Pick at least one community");
      return;
    }
    setBusy(true);
    try {
      await joinCommunities({
        data: {
          communityIds: selected,
          primaryId: primaryId ?? selected[0],
          joinedVia: search.code ? "invite" : "browse",
          inviteCode: inviteCode || search.code,
        },
      });
      await upsertProfile({
        data: {
          ...profilePayload(),
          notify_events: notifyEvents,
          notify_needs: notifyNeeds,
          notify_services: notifyServices,
          notify_facilities: notifyFacilities,
          welcome_seen: true,
        },
      });
      toast.success("You're in — welcome to the neighborhood");
      await navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join communities");
    } finally {
      setBusy(false);
    }
  }

  function toggleCommunity(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (primaryId && !next.includes(primaryId)) setPrimaryId(next[0]);
      if (!primaryId && next[0]) setPrimaryId(next[0]);
      return next;
    });
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-fg">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-primary text-primary-fg">
            <HandHeart className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Neighborly setup</p>
            <p className="text-sm text-fg-muted">
              Step {step} of 4 · signed in as {user.primaryEmail ?? user.displayName}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                n <= step ? "bg-primary" : "bg-bg-subtle",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>About you</CardTitle>
              <CardDescription>
                This is what neighbors see when you offer help or post a need. Keep
                addresses approximate for privacy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="First name + last initial works well"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="street">Area hint (optional)</Label>
                <Input
                  id="street"
                  value={streetHint}
                  onChange={(e) => setStreetHint(e.target.value)}
                  placeholder="e.g. Maple Court · near the park"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Only shared when you choose to connect"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Short bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Who you are in the community — retired teacher, new parent, HOA board, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Skills & ways you can help</Label>
                <ChipSelect options={SKILL_OPTIONS} value={skills} onChange={setSkills} />
              </div>
              <label className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
                <Checkbox checked={isNew} onCheckedChange={(v) => setIsNew(Boolean(v))} />
                <span>
                  <span className="block text-sm font-medium">I'm new here</span>
                  <span className="text-xs text-fg-muted">
                    We'll highlight welcome events and introduce-yourself prompts.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
                <Checkbox checked={isYouth} onCheckedChange={(v) => setIsYouth(Boolean(v))} />
                <span>
                  <span className="block text-sm font-medium">Youth services profile</span>
                  <span className="text-xs text-fg-muted">
                    For teens offering lawn care, pet sitting, tutoring — parents should know.
                  </span>
                </span>
              </label>
              <Button className="w-full" onClick={() => void saveProfileAndContinue()} disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Who you are becoming</CardTitle>
              <CardDescription>
                This is not a diagnosis and not a dating wall. It helps us point you at
                groups that will build you up — you can still try more than one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Life season</Label>
                <div className="flex flex-wrap gap-2">
                  {LIFE_SEASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLifeSeason(opt.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        lifeSeason === opt.id
                          ? "border-primary bg-primary text-primary-fg"
                          : "border-border bg-bg-elevated text-fg-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Faith / meaning</Label>
                <div className="flex flex-wrap gap-2">
                  {FAITH_POSTURE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFaithPosture(opt.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-left text-sm",
                        faithPosture === opt.id
                          ? "border-primary bg-primary text-primary-fg"
                          : "border-border bg-bg-elevated text-fg-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoping">What you're hoping for (optional)</Label>
                <Textarea
                  id="hoping"
                  value={hopingFor}
                  onChange={(e) => setHopingFor(e.target.value)}
                  placeholder="Belonging, a friend, to be a better dad, to serve, to get off the couch…"
                />
                <p className="text-xs text-fg-subtle">
                  Not a mental-health form. Leaders never see a raw score. If you are in crisis, call 988.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Interests</Label>
                <ChipSelect options={INTEREST_OPTIONS} value={interests} onChange={setInterests} />
              </div>
              <div className="space-y-2">
                <Label>When you can show up</Label>
                <ChipSelect
                  options={AVAILABILITY_OPTIONS}
                  value={availability}
                  onChange={setAvailability}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={() => applySuggestedAndContinue()} disabled={busy}>
                  {busy ? "Saving…" : "See groups that fit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Your communities</CardTitle>
              <CardDescription>
                Join more than one — neighborhood, church, HOA, vacation home, or a place
                you're interested in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Invite / QR code"
                  className="uppercase"
                />
                <Button type="button" variant="secondary" onClick={() => void applyInviteCode()}>
                  Apply code
                </Button>
              </div>

              <div className="space-y-2">
                {communities.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCommunity(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-colors",
                        on
                          ? "border-primary bg-primary-soft/50"
                          : "border-border bg-bg-elevated hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                          on ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
                        )}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-fg">{c.name}</span>
                          <Badge variant="secondary">{KIND_LABELS[c.kind]}</Badge>
                          {c.is_featured && <Badge>Test market</Badge>}
                        </span>
                        <span className="mt-0.5 block text-sm text-fg-muted">{c.tagline}</span>
                        <span className="mt-1 block text-xs text-fg-subtle">
                          {c.city}, {c.state} · code {c.invite_code}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedCommunities.length > 1 && (
                <div className="space-y-2">
                  <Label>Primary community (home base)</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCommunities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPrimaryId(c.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm",
                          primaryId === c.id
                            ? "border-primary bg-primary text-primary-fg"
                            : "border-border bg-bg-elevated text-fg-muted",
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => setStep(4)}
                  disabled={selected.length === 0}
                >
                  Continue to next steps
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>What should we notify you about?</CardTitle>
              <CardDescription>
                Preferences are saved on your profile so events, matching needs, and
                local services can reach the right people.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Events & gatherings",
                  hint: "Block parties, cleanups, BBQs, meetings",
                  checked: notifyEvents,
                  set: setNotifyEvents,
                },
                {
                  label: "Neighbor needs that match your skills",
                  hint: "When someone nearby needs the kind of help you offer",
                  checked: notifyNeeds,
                  set: setNotifyNeeds,
                },
                {
                  label: "New local services",
                  hint: "Businesses and youth offerings in your communities",
                  checked: notifyServices,
                  set: setNotifyServices,
                },
                {
                  label: "Facility availability",
                  hint: "Pavilions and rooms you can reserve",
                  checked: notifyFacilities,
                  set: setNotifyFacilities,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border bg-bg px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-fg">{row.label}</p>
                    <p className="text-xs text-fg-muted">{row.hint}</p>
                  </div>
                  <Switch checked={row.checked} onCheckedChange={row.set} />
                </div>
              ))}

              <div className="rounded-[var(--radius-lg)] border border-border bg-primary-soft/40 p-4 text-sm text-fg">
                You're joining{" "}
                <strong>{selectedCommunities.map((c) => c.name).join(", ") || "—"}</strong>
                {isNew ? " · marked as new resident" : ""}.
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Recommended next steps</p>
                <p className="text-xs text-fg-muted">
                  We do not create accounts in other apps for you. Open the door when you
                  are ready. Friendship before dating. More than one group is allowed.
                </p>
                {recommendNextSteps({
                  life_season: lifeSeason,
                  faith_posture: faithPosture,
                  hoping_for: hopingFor,
                  interests,
                }).map((rec) => (
                  <a
                    key={rec.href}
                    href={rec.href}
                    className="block rounded-[var(--radius-lg)] border border-border p-3 no-underline hover:border-border-strong"
                    target={rec.kind === "app" ? "_blank" : undefined}
                    rel={rec.kind === "app" ? "noreferrer" : undefined}
                  >
                    <p className="font-medium text-fg">{rec.title}</p>
                    <p className="text-sm text-fg-muted">{rec.why}</p>
                  </a>
                ))}
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void finish()}
                  disabled={busy}
                >
                  {busy ? "Joining…" : "Enter Neighborly"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
