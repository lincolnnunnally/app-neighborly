import { KIND_LABELS, type Community } from "@/lib/community/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  sage: "from-[color-mix(in_oklab,var(--color-primary)_18%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  sky: "from-[color-mix(in_oklab,var(--color-sky)_16%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  clay: "from-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  water: "from-[color-mix(in_oklab,var(--color-sky)_22%,var(--color-bg))] to-[var(--color-bg-elevated)]",
};

export function CommunityCover({
  community,
  className,
  compact,
}: {
  community: Community;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br p-5",
        colorMap[community.cover_color] ?? colorMap.sage,
        compact ? "p-4" : "p-6 sm:p-8",
        className,
      )}
    >
      <div className="relative z-10 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{KIND_LABELS[community.kind]}</Badge>
          {community.is_featured && (
            <Badge>
              {community.slug === "milstead"
                ? "First test market"
                : community.slug === "vidalia"
                  ? "Live in Vidalia"
                  : "Featured"}
            </Badge>
          )}
          <span className="text-xs text-fg-muted">
            {community.city}, {community.state} · {community.member_count} neighbors
          </span>
        </div>
        <h2
          className={cn(
            "font-display font-semibold tracking-tight text-fg",
            compact ? "text-xl" : "text-2xl sm:text-3xl",
          )}
        >
          {community.name}
        </h2>
        <p className={cn("text-fg-muted", compact ? "text-sm" : "max-w-2xl text-base")}>
          {community.tagline}
        </p>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
      />
    </div>
  );
}
