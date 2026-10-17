import { KIND_LABELS, type Community } from "@/lib/community/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  sage: "from-[color-mix(in_oklab,var(--color-primary)_18%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  sky: "from-[color-mix(in_oklab,var(--color-sky)_16%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  clay: "from-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-bg))] to-[var(--color-bg-elevated)]",
  water: "from-[color-mix(in_oklab,var(--color-sky)_22%,var(--color-bg))] to-[var(--color-bg-elevated)]",
};

const TOWN_PHOTOS: Record<string, { src: string; alt: string; credit?: string }> = {
  vidalia: { src: "/img/vidalia/fountain.jpg", alt: "The fountain in Vidalia's downtown park" },
  "vidalia-pickleball": { src: "/img/vidalia/amphitheater.jpg", alt: "The downtown park amphitheater in Vidalia" },
  "vidalia-outdoors": { src: "/img/vidalia/amphitheater.jpg", alt: "The downtown park amphitheater in Vidalia" },
  "vidalia-dads": { src: "/img/vidalia/cityhall.jpg", alt: "The Vidalia Municipal Building downtown" },
  "vidalia-makers": { src: "/img/vidalia/downtown.jpg", alt: "The Vidalia water tower" },
  atlanta: { src: "/img/towns/atlanta.jpg", alt: "The Midtown Atlanta skyline from Piedmont Park", credit: "Photo: Thomson200, CC0, via Wikimedia Commons" },
  conyers: { src: "/img/towns/conyers.jpg", alt: "Painted storefronts in downtown Conyers", credit: "Photo: formulanone, CC BY-SA 2.0, via Wikimedia Commons" },
  milstead: { src: "/img/towns/rockdale.jpg", alt: "The Rockdale County Courthouse in Conyers, near Milstead", credit: "Photo: Skarg, CC BY 2.5, via Wikimedia Commons" },
  "milstead-fellowship": { src: "/img/towns/rockdale.jpg", alt: "The Rockdale County Courthouse in Conyers, near Milstead", credit: "Photo: Skarg, CC BY 2.5, via Wikimedia Commons" },
  "oakridge-hoa": { src: "/img/towns/rockdale.jpg", alt: "The Rockdale County Courthouse in Conyers, near Milstead", credit: "Photo: Skarg, CC BY 2.5, via Wikimedia Commons" },
};

export function townPhoto(slug: string) {
  return TOWN_PHOTOS[slug] ?? null;
}

/** A captioned photo of this board's own town, or nothing (never another town's picture). */
export function townFigure(slug: string | null | undefined) {
  const photo = slug ? townPhoto(slug) : null;
  if (!photo) return null;
  return (
    <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-border">
      <img src={photo.src} alt={photo.alt} className="aspect-[16/9] w-full object-cover" />
      <figcaption className="bg-bg-elevated px-4 py-2 text-sm text-fg-muted">
        {photo.alt}.{photo.credit ? ` ${photo.credit}.` : ""}
      </figcaption>
    </figure>
  );
}

export function CommunityCover({
  community,
  className,
  compact,
  headingLevel = 1,
}: {
  community: Community;
  className?: string;
  compact?: boolean;
  headingLevel?: 1 | 2;
}) {
  const photo = compact ? null : townPhoto(community.slug);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-gradient-to-br p-5",
        photo && "grid gap-6 md:grid-cols-[1fr_1fr] md:items-center",
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
              {community.slug === "vidalia" ? "Vidalia, Georgia" : "Featured"}
            </Badge>
          )}
          <span className="text-base text-fg-muted">
            {community.city}, {community.state}
            {community.member_count > 1 ? ` · ${community.member_count} neighbors` : ""}
          </span>
          {community.member_count <= 1 && <Badge variant="accent">New</Badge>}
        </div>
        {compact || headingLevel === 2 ? (
          <h2 className={cn("font-display font-semibold tracking-tight text-fg", compact ? "text-xl" : "text-2xl sm:text-3xl")}>
            {community.name}
          </h2>
        ) : (
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">{community.name}</h1>
        )}
        <p className={cn("text-fg-muted", compact ? "text-sm" : "max-w-2xl text-base")}>
          {community.tagline}
        </p>
      </div>
      {photo &&
        (photo.credit ? (
          <figure className="relative z-10 space-y-1">
            <img src={photo.src} alt={photo.alt} className="aspect-video w-full rounded-[var(--radius-lg)] object-cover" />
            <figcaption className="text-sm text-fg-muted">{photo.credit}</figcaption>
          </figure>
        ) : (
          <img
            src={photo.src}
            alt={photo.alt}
            className="relative z-10 aspect-video w-full rounded-[var(--radius-lg)] object-cover"
          />
        ))}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
      />
    </div>
  );
}
