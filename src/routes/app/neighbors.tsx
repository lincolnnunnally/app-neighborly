import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getCommunityFeed, getMyMemberships } from "@/lib/community/server";
import type { Membership, Neighbor } from "@/lib/community/types";
import { ReportBlockControls } from "@/components/safety/report-block";

export const Route = createFileRoute("/app/neighbors")({
  component: NeighborsPage,
});

function NeighborsPage() {
  const user = useCurrentUser();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);

  async function reload(mid?: string) {
    const m = await getMyMemberships();
    setMemberships(m);
    const primary = m.find((x) => x.is_primary) ?? m[0];
    const id = mid || communityId || primary?.community_id || "";
    setCommunityId(id);
    const slug = m.find((x) => x.community_id === id)?.community?.slug;
    if (!slug) return;
    const feed = await getCommunityFeed({ data: { slug, userId: user?.id } });
    setNeighbors(feed.neighbors);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Neighbors</h1>
        <p className="text-sm text-fg-muted">
          Meet people who can help — and people who just moved in.
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
        {neighbors.map((n) => (
          <article key={n.user_id} className="surface-card p-4">
            <div className="mb-2 flex flex-wrap gap-2">
              {n.is_new_resident && <Badge variant="accent">New resident</Badge>}
              {n.is_youth && <Badge variant="sky">Youth</Badge>}
              <Badge variant="outline">{n.role}</Badge>
            </div>
            <h2 className="font-medium">{n.display_name}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {n.bio || "Member of this community"}
            </p>
            {n.street_hint && (
              <p className="mt-1 text-xs text-fg-subtle">{n.street_hint}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {n.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
            {n.user_id !== user?.id && (
              <div className="mt-3">
                <ReportBlockControls
                  contentType="person"
                  reportedUserId={n.user_id}
                  reportedUserName={n.display_name}
                  contentExcerpt={n.bio || n.display_name}
                  allowBlock
                  onBlocked={() => void reload(communityId)}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
