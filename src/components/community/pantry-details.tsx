import { Clock, ExternalLink, Facebook, Info, MapPin, Navigation, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  coordsForPantry,
  fieldOrUnlisted,
  isClosedListing,
  isPublicListing,
  isUnconfirmedListing,
  pantryAddressLine,
  pantryCallAheadNote,
  pantryMapsDirUrl,
  pantryServeLine,
  pantrySourceLine,
} from "@/lib/community/pantry";
import type { Facility } from "@/lib/community/types";

export function PantryDetails({
  pantry,
  compact = false,
}: {
  pantry: Facility;
  compact?: boolean;
}) {
  const coords = coordsForPantry(pantry.id);
  const drive = pantryMapsDirUrl({ ...pantry, lat: coords?.lat, lon: coords?.lon });
  const line = pantryAddressLine(pantry);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">Food pantry</Badge>
        {pantry.city ? <Badge variant="outline">{pantry.city}</Badge> : null}
        {pantry.zip ? <Badge variant="secondary">{pantry.zip}</Badge> : null}
        {isPublicListing(pantry) ? <Badge variant="outline">Public listing</Badge> : null}
        {isClosedListing(pantry) ? (
          <Badge variant="secondary" data-testid="pantry-closed">
            Closed or moved
          </Badge>
        ) : null}
        {isUnconfirmedListing(pantry) && !isClosedListing(pantry) ? (
          <Badge variant="secondary" data-testid="pantry-unconfirmed">
            Unconfirmed
          </Badge>
        ) : null}
      </div>
      <h3 className="font-medium text-fg">{pantry.name}</h3>
      <p className="flex items-start gap-1.5 text-sm text-fg-muted">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {drive && line ? (
          <a
            className="text-primary underline"
            href={drive}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {line}
          </a>
        ) : (
          line || "Address not listed"
        )}
      </p>
      {drive ? (
        <a
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
          href={drive}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Navigation className="h-3.5 w-3.5" />
          Drive
        </a>
      ) : null}
      <p className="flex items-start gap-1.5 text-sm text-fg-muted">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {pantryServeLine(pantry)}
      </p>
      {!compact && pantry.description ? (
        <p className="text-sm text-fg-muted">{pantry.description}</p>
      ) : null}
      {!compact ? (
      <dl className="grid gap-1.5 text-sm">
        <div>
          <dt className="text-xs text-fg-subtle">Residency / ZIP limits</dt>
          <dd className="text-fg">{fieldOrUnlisted(pantry.residency_note)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Visit frequency</dt>
          <dd className="text-fg">{fieldOrUnlisted(pantry.visit_frequency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">ID / documents</dt>
          <dd className="text-fg">{fieldOrUnlisted(pantry.id_docs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Other notes</dt>
          <dd className="text-fg">{fieldOrUnlisted(pantry.other_notes)}</dd>
        </div>
      </dl>
      ) : null}
      {/* Provenance before contact: a neighbor deciding whether to drive over
          needs to know where these facts came from and how old they are. */}
      <p className="flex items-start gap-1.5 text-xs text-fg-subtle">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {isUnconfirmedListing(pantry)
          ? `Copied from a public directory and not confirmed by anyone local. ${pantryCallAheadNote(pantry)}`
          : pantryCallAheadNote(pantry)}
      </p>
      {pantrySourceLine(pantry) ? (
        <p className="flex items-start gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {pantry.source_url ? (
            <a
              className="text-primary underline"
              href={pantry.source_url}
              target="_blank"
              rel="noreferrer"
            >
              {pantrySourceLine(pantry)}
            </a>
          ) : (
            <span>{pantrySourceLine(pantry)}</span>
          )}
        </p>
      ) : null}
      {(pantry.phone || pantry.website || pantry.facebook_url) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {pantry.phone ? (
            <a className="inline-flex items-center gap-1 text-primary" href={`tel:${pantry.phone}`}>
              <Phone className="h-3.5 w-3.5" />
              {pantry.phone}
            </a>
          ) : null}
          {pantry.website ? (
            <a
              className="inline-flex items-center gap-1 text-primary"
              href={pantry.website}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Website
            </a>
          ) : null}
          {/* Usually the liveliest source: a small pantry posts a closure or a
              changed day here long before any directory catches up. */}
          {pantry.facebook_url ? (
            <a
              className="inline-flex items-center gap-1 text-primary"
              href={pantry.facebook_url}
              target="_blank"
              rel="noreferrer"
            >
              <Facebook className="h-3.5 w-3.5" />
              Facebook — often the latest hours
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
