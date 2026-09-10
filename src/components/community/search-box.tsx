import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEARCH_EXAMPLES } from "@/lib/community/search";

/**
 * The free-text box the app was missing.
 *
 * Deliberately separate from PlaceSearch (`components/community/place-search`):
 * that one answers "which town?" and navigates to a board. This one answers
 * "what am I looking for?" and navigates to /search. Both can sit on the same
 * page without competing — they ask different questions.
 */
export function SearchBox({
  defaultValue = "",
  slug,
  size = "md",
  autoFocus = false,
  showExamples = true,
  placeholder = "Search for anything — food pantry, bible study, help with my yard",
}: {
  defaultValue?: string;
  /** Keeps the search on one board when the neighbor started from that board. */
  slug?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
  showExamples?: boolean;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultValue);

  useEffect(() => {
    setQ(defaultValue);
  }, [defaultValue]);

  async function go(term: string) {
    const value = term.trim();
    if (!value) return;
    await navigate({ to: "/search", search: { q: value, slug: slug || undefined } });
  }

  return (
    <div className="w-full space-y-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void go(q);
        }}
        className={size === "lg" ? "flex flex-col gap-2 sm:flex-row" : "flex gap-2"}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label="Search Neighborly"
            data-testid="search-input"
            autoFocus={autoFocus}
            className={size === "lg" ? "h-12 pl-9 text-base" : "pl-9"}
          />
        </div>
        <Button type="submit" data-testid="search-submit" size={size === "lg" ? "lg" : "default"}>
          Search
        </Button>
      </form>
      {showExamples && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-subtle">Try:</span>
          {SEARCH_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              data-testid={`search-example-${example.replace(/\s+/g, "-")}`}
              onClick={() => {
                setQ(example);
                void go(example);
              }}
              className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
