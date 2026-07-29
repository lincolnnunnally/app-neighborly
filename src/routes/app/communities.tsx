import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMyMemberships,
  joinCommunities,
  leaveCommunity,
  listCommunities,
  resolveInvite,
} from "@/lib/community/server";
import { KIND_LABELS, type Community, type Membership } from "@/lib/community/types";

export const Route = createFileRoute("/app/communities")({
  component: AppCommunitiesPage,
});

function AppCommunitiesPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [all, setAll] = useState<Community[]>([]);
  const [code, setCode] = useState("");

  async function reload() {
    const [m, c] = await Promise.all([getMyMemberships(), listCommunities()]);
    setMemberships(m);
    setAll(c);
  }

  useEffect(() => {
    void reload();
  }, []);

  const memberIds = new Set(memberships.map((m) => m.community_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Your communities</h1>
        <p className="text-sm text-fg-muted">
          Belong to many places — neighborhood, church, HOA, vacation home.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Add via invite code"
          className="uppercase sm:max-w-xs"
        />
        <Button
          onClick={async () => {
            try {
              const inv = await resolveInvite({ data: code });
              if (!inv) {
                toast.error("Code not found");
                return;
              }
              await joinCommunities({
                data: {
                  communityIds: [inv.community.id],
                  joinedVia: "invite",
                  inviteCode: code,
                },
              });
              toast.success(`Joined ${inv.community.name}`);
              setCode("");
              await reload();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not join");
            }
          }}
        >
          Join with code
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg-muted">Joined</h2>
        {memberships.map((m) => (
          <div
            key={m.id}
            className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{m.community?.name}</p>
                {m.is_primary && <Badge>Primary</Badge>}
                <Badge variant="outline">{m.joined_via}</Badge>
              </div>
              <p className="text-sm text-fg-muted">{m.community?.tagline}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {m.community && (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/c/$slug" params={{ slug: m.community.slug }}>
                    Open
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await leaveCommunity({ data: m.community_id });
                  toast.message("Left community");
                  await reload();
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg-muted">Discover more</h2>
        {all
          .filter((c) => !memberIds.has(c.id))
          .map((c) => (
            <div
              key={c.id}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  <Badge variant="secondary">{KIND_LABELS[c.kind]}</Badge>
                </div>
                <p className="text-sm text-fg-muted">{c.tagline}</p>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  await joinCommunities({
                    data: { communityIds: [c.id], joinedVia: "browse" },
                  });
                  toast.success(`Joined ${c.name}`);
                  await reload();
                }}
              >
                Join
              </Button>
            </div>
          ))}
      </section>
    </div>
  );
}
