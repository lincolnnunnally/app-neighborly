import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Search as SearchIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchBox } from "@/components/community/search-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { searchNeighborly, type SearchResponse } from "@/lib/community/search-server";
import {
  KIND_LABELS,
  SEARCH_SCOPES,
  parseQuery,
  highlightParts,
  type SearchHit,
  type SearchScope,
} from "@/lib/community/search";

type SearchParams = { q?: string; scope?: string; slug?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : undefined,
    scope: typeof s.scope === "string" ? s.scope : undefined,
    slug: typeof s.slug === "string" ? s.slug : undefined,
  }),
  head: ({ match }) => {
    const q = match.search.q;
    const title = q ? `Search: ${q} — Neighborly` : "Search Neighborly";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Search everything on Neighborly — food pantries, needs, events and Bible studies, services, tools, places and neighbors. Real listings only; we will not invent results.",
        },
      ],
    };
  },
  component: SearchPage,
});

function Highlight({ text, query }: { text: string; query: string }) {
  const parsed = parseQuery(query);
  return (
    <>
      {highlightParts(text, parsed).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-fg">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ResultCard({ hit, query }: { hit: SearchHit; query: string }) {
  return (
    // Plain anchor, not <Link>: hits carry query strings (?tab=places&cat=pantry)
    // that the typed router's `to` prop does not model. Same pattern the hub's
    // recommendation cards already use.
    <a
      href={hit.href}
      data-testid={`search-hit-${hit.kind}`}
      className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Badge variant={hit.kind === "pantry" ? "accent" : "secondary"}>
          {KIND_LABELS[hit.kind]}
        </Badge>
        {hit.badges.filter(Boolean).slice(0, 3).map((b) => (
          <Badge key={b} variant="outline">
            {b}
          </Badge>
        ))}
        <span className="text-xs text-fg-subtle">{hit.community_name}</span>
      </div>
      <p className="font-medium text-fg">
        <Highlight text={hit.title} query={query} />
      </p>
      {hit.meta ? (
        <p className="mt-0.5 text-sm text-fg-muted">
          <Highlight text={hit.meta} query={query} />
        </p>
      ) : null}
      {hit.snippet ? (
        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">
          <Highlight text={hit.snippet} query={query} />
        </p>
      ) : null}
    </a>
  );
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const q = search.q ?? "";
  const scope = (search.scope ?? "all") as SearchScope;

  useEffect(() => {
    if (!q.trim()) {
      setResult(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    searchNeighborly({ data: { q, scope, slug: search.slug, userId: user?.id } })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setResult(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [q, scope, search.slug, user?.id]);

  const hits = result?.hits ?? [];
  const counts = result?.counts;
  // Split so a synonym-only pile never masquerades as "17 results".
  const direct = hits.filter((h) => !h.loose);
  const loose = hits.filter((h) => h.loose);

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <main className="page-shell max-w-3xl space-y-6 py-10">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Search</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Look for whatever you actually need
          </h1>
          <p className="text-fg-muted">
            Type it the way you would say it. This searches every board — food pantries,
            needs, events and groups, services, tools, places, and (once you are signed in)
            neighbors who listed that skill. Only real listings come back.
          </p>
        </div>

        <SearchBox defaultValue={q} slug={search.slug} size="lg" autoFocus={!q} />

        {search.slug ? (
          <p className="text-sm text-fg-muted">
            Searching the <strong className="text-fg">{search.slug}</strong> board only.{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() =>
                void navigate({ to: "/search", search: { q, scope, slug: undefined } })
              }
            >
              Search every community instead
            </button>
          </p>
        ) : null}

        {q.trim() ? (
          <div className="flex flex-wrap gap-2" data-testid="search-scopes">
            {SEARCH_SCOPES.map((s) => {
              const n = s.id === "all" ? direct.length : (counts?.[s.id] ?? 0);
              // Hide empty scopes so the row stays honest about what was found.
              if (s.id !== "all" && s.id !== scope && n === 0) return null;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`search-scope-${s.id}`}
                  onClick={() =>
                    void navigate({
                      to: "/search",
                      search: { q, slug: search.slug, scope: s.id === "all" ? undefined : s.id },
                      replace: true,
                    })
                  }
                  className={
                    scope === s.id
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-fg"
                      : "rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-sm text-fg-muted"
                  }
                >
                  {s.label}
                  {n > 0 ? ` · ${n}` : ""}
                </button>
              );
            })}
          </div>
        ) : null}

        {status === "loading" && <p className="text-sm text-fg-muted">Searching…</p>}

        {status === "error" && (
          <p className="text-sm text-danger">
            Search could not run just now. Try again — we will not show made-up results
            instead.
          </p>
        )}

        {status === "ready" && (
          <section className="space-y-3" data-testid="search-results">
            <p className="text-sm text-fg-muted">
              {direct.length === 0
                ? `Nothing on the boards matches “${q}” yet.`
                : `${direct.length} ${direct.length === 1 ? "result" : "results"} for “${q}”`}
            </p>
            {direct.map((hit) => (
              <ResultCard key={`${hit.kind}-${hit.id}`} hit={hit} query={q} />
            ))}
          </section>
        )}

        {status === "ready" && loose.length > 0 && (
          <section className="space-y-3" data-testid="search-loose">
            <h2 className="font-display text-lg font-semibold">
              {direct.length === 0 ? "Closest things on the board" : "Related"}
            </h2>
            <p className="text-sm text-fg-muted">
              These do not contain the words you typed — they came up because they are
              about something similar. Nothing here is a match we are dressing up.
            </p>
            {loose.slice(0, 12).map((hit) => (
              <ResultCard key={`loose-${hit.kind}-${hit.id}`} hit={hit} query={q} />
            ))}
          </section>
        )}

        {status === "ready" && (result?.doors.length ?? 0) > 0 && (
          <section className="space-y-3" data-testid="search-doors">
            <h2 className="font-display text-lg font-semibold">
              {direct.length === 0 ? "Try these instead" : "Related places to look"}
            </h2>
            {result?.doors.map((door) =>
              door.external ? (
                <a
                  key={door.id}
                  href={door.href}
                  target="_blank"
                  rel="noreferrer"
                  className="surface-card flex items-start justify-between gap-3 p-4 no-underline transition-colors hover:border-border-strong"
                >
                  <span>
                    <span className="block font-medium text-fg">{door.title}</span>
                    <span className="text-sm text-fg-muted">{door.why}</span>
                  </span>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-fg-subtle" />
                </a>
              ) : (
                <a
                  key={door.id}
                  href={door.href}
                  className="surface-card block p-4 no-underline transition-colors hover:border-border-strong"
                >
                  <span className="block font-medium text-fg">{door.title}</span>
                  <span className="text-sm text-fg-muted">{door.why}</span>
                </a>
              ),
            )}
          </section>
        )}

        {status === "ready" && direct.length === 0 && (
          <div className="surface-card space-y-3 p-4">
            <p className="text-sm text-fg-muted">
              An empty result is the honest answer — nobody has posted this yet. You can be
              the first: post it as a need, or add the listing if you can speak for it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/app/needs">Post a need</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/app/places" search={{ register: "1" }}>
                  Add a pantry listing
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link to="/app/events">Host something</Link>
              </Button>
            </div>
          </div>
        )}

        {status === "idle" && (
          <div className="surface-card space-y-2 p-4">
            <p className="flex items-center gap-2 font-medium text-fg">
              <SearchIcon className="h-4 w-4 text-primary" />
              Nothing typed yet
            </p>
            <p className="text-sm text-fg-muted">
              Search runs across every community board on Neighborly. Looking for a town
              instead of a thing?{" "}
              <Link to="/near" className="text-primary underline">
                Find a town by ZIP
              </Link>
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
