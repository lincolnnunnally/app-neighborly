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
import { INTEREST_OPTIONS, SKILL_OPTIONS, type Profile } from "@/lib/community/types";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => setProfile(null));
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
                is_new_resident: profile.is_new_resident,
                is_youth: profile.is_youth,
                notify_events: profile.notify_events,
                notify_needs: profile.notify_needs,
                notify_services: profile.notify_services,
                notify_facilities: profile.notify_facilities,
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
    </div>
  );
}
