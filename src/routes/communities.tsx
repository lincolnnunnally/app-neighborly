import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCommunities } from "@/lib/community/server";
import { KIND_LABELS, type Community } from "@/lib/community/types";

export const Route = createFileRoute("/communities")({
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    listCommunities().then(setCommunities).catch(() => setCommunities([]));
  }, []);

  const filtered = communities.filter((c) => {
    const hay = `${c.name} ${c.city} ${c.tagline} ${c.kind}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <div className="page-shell space-y-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Communities</h1>
            <p className="mt-1 text-fg-muted">
              Choose one or many. Milstead is the first live test market.
            </p>
          </div>
          <Button asChild>
            <Link to="/signup" search={{ community: "milstead", code: "MILSTEAD-WELCOME" }}>
              Join with profile
            </Link>
          </Button>
        </div>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, city, or type…"
          className="max-w-md"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <div key={c.id} className="surface-card flex flex-col p-5">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{KIND_LABELS[c.kind]}</Badge>
                {c.is_featured && <Badge>Featured</Badge>}
              </div>
              <h2 className="font-display text-xl font-semibold">{c.name}</h2>
              <p className="mt-1 flex-1 text-sm text-fg-muted">{c.description}</p>
              <p className="mt-3 text-xs text-fg-subtle">
                {c.city}, {c.state} · {c.member_count} members · invite {c.invite_code}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/c/$slug" params={{ slug: c.slug }}>
                    Open
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/join/$code" params={{ code: c.invite_code }}>
                    Invite / QR
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/signup" search={{ community: c.slug, code: c.invite_code }}>
                    Join
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
