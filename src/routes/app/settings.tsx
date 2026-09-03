import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChipSelect } from "@/components/community/chip-select";
import { getMyProfile, upsertProfile } from "@/lib/community/server";
import { listMyBlocks, unblockUser, type UserBlock } from "@/lib/community/safety";
import {
  AVAILABILITY_OPTIONS,
  FAITH_POSTURE_OPTIONS,
  INTEREST_OPTIONS,
  LIFE_SEASON_OPTIONS,
  MOBILITY_OPTIONS,
  SETTING_PREF_OPTIONS,
  SKILL_OPTIONS,
  type Profile,
} from "@/lib/community/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => setProfile(null));
    listMyBlocks().then(setBlocks).catch(() => setBlocks([]));
  }, []);

  if (!profile) {
    return <div className="h-32 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Profile & alerts</h1>
        <p className="text-sm text-fg-muted">
          Control how you show up and what you hear about.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const next = await upsertProfile({
              data: {
                display_name: profile.display_name,
                bio: profile.bio,
                phone: profile.phone,
                street_hint: profile.street_hint,
                skills: profile.skills,
                help_offerings: profile.skills,
                interests: profile.interests,
                life_season: profile.life_season,
                faith_posture: profile.faith_posture,
                hoping_for: profile.hoping_for,
                availability: profile.availability,
                is_new_resident: profile.is_new_resident,
                is_youth: profile.is_youth,
                notify_events: profile.notify_events,
                notify_needs: profile.notify_needs,
                notify_services: profile.notify_services,
                notify_facilities: profile.notify_facilities,
                setting_pref: profile.setting_pref,
                mobility: profile.mobility,
                digest_opt_in: profile.digest_opt_in,
                digest_cadence: profile.digest_cadence,
              },
            });
            setProfile(next);
            toast.success("Saved");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input
            value={profile.display_name}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Area hint</Label>
          <Input
            value={profile.street_hint}
            onChange={(e) => setProfile({ ...profile, street_hint: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Skills</Label>
          <ChipSelect
            options={SKILL_OPTIONS}
            value={profile.skills}
            onChange={(skills) => setProfile({ ...profile, skills })}
          />
        </div>
        <div className="space-y-2">
          <Label>Interests</Label>
          <ChipSelect
            options={INTEREST_OPTIONS}
            value={profile.interests}
            onChange={(interests) => setProfile({ ...profile, interests })}
          />
        </div>
        <div className="space-y-2">
          <Label>Life season</Label>
          <div className="flex flex-wrap gap-2">
            {LIFE_SEASON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProfile({ ...profile, life_season: opt.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  profile.life_season === opt.id
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
                onClick={() => setProfile({ ...profile, faith_posture: opt.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-left text-sm",
                  profile.faith_posture === opt.id
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
          <Label>What you're hoping for</Label>
          <Textarea
            value={profile.hoping_for}
            onChange={(e) => setProfile({ ...profile, hoping_for: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Indoor or outdoor</Label>
          <div className="flex flex-wrap gap-2">
            {SETTING_PREF_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProfile({ ...profile, setting_pref: opt.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  profile.setting_pref === opt.id
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
          <Label>How you like to move</Label>
          <div className="flex flex-wrap gap-2">
            {MOBILITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProfile({ ...profile, mobility: opt.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-left text-sm",
                  profile.mobility === opt.id
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-bg-elevated text-fg-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-fg-subtle">
            If you need seated options, we will not lead with hiking. Fit matters more if you
            ever pay for a digest.
          </p>
        </div>
        <div className="space-y-2">
          <Label>When you can show up</Label>
          <ChipSelect
            options={AVAILABILITY_OPTIONS}
            value={profile.availability}
            onChange={(availability) => setProfile({ ...profile, availability })}
          />
        </div>

        <div className="space-y-3 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4">
          <p className="text-sm font-medium">Weekly fit list (not billed yet)</p>
          <p className="text-xs text-fg-muted">
            When we can actually email things that match you, a few dollars a month would
            cover a weekly note with Add to calendar / not interested. We will not take
            money until that mail arrives. Join the waitlist if you want it.
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg-muted">Email me a weekly fit list when it is real</span>
            <Switch
              checked={profile.digest_opt_in}
              onCheckedChange={(v) =>
                setProfile({
                  ...profile,
                  digest_opt_in: v,
                  digest_cadence: v ? "weekly" : "off",
                })
              }
            />
          </div>
        </div>

        <div className="space-y-3 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4">
          <p className="text-sm font-medium">Notifications</p>
          {(
            [
              ["notify_events", "Events & gatherings"],
              ["notify_needs", "Needs that match my skills"],
              ["notify_services", "New local services"],
              ["notify_facilities", "Facility availability"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-muted">{label}</span>
              <Switch
                checked={profile[key]}
                onCheckedChange={(v) => setProfile({ ...profile, [key]: v })}
              />
            </div>
          ))}
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <section className="space-y-3 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4">
        <div>
          <h2 className="font-medium">Blocked neighbors</h2>
          <p className="text-sm text-fg-muted">
            Blocked people leave your feed. This does not delete their account.
          </p>
        </div>
        {blocks.length === 0 ? (
          <p className="text-sm text-fg-subtle">You have not blocked anyone.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.blocked_id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{b.display_name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await unblockUser({ data: { userId: b.blocked_id } });
                      setBlocks((prev) => prev.filter((x) => x.blocked_id !== b.blocked_id));
                      toast.success("Unblocked");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not unblock");
                    }
                  }}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
