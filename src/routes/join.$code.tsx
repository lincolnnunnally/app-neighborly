import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { QrCode, Share2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { CommunityCover } from "@/components/community/cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveInvite } from "@/lib/community/server";
import type { Community } from "@/lib/community/types";

export const Route = createFileRoute("/join/$code")({
  component: JoinInvitePage,
});

function JoinInvitePage() {
  const { code } = Route.useParams();
  const [community, setCommunity] = useState<Community | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    resolveInvite({ data: code })
      .then((r) => {
        setCommunity(r?.community ?? null);
        setLabel(r?.label ?? "");
      })
      .finally(() => setLoading(false));
  }, [code]);

  const joinUrl = origin ? `${origin}/join/${encodeURIComponent(code.toUpperCase())}` : "";
  const qrSrc = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(joinUrl)}`
    : "";

  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader solid />
      <div className="page-shell space-y-6 py-10">
        {loading ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-bg-subtle" />
        ) : !community ? (
          <Card>
            <CardHeader>
              <CardTitle>Invite not found</CardTitle>
              <CardDescription>
                Code <strong>{code}</strong> isn't recognized. Check the flyer or ask a
                neighbor for a fresh link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/communities">Browse communities</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">You're invited</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                Join {community.name}
              </h1>
              <p className="max-w-2xl text-fg-muted">
                {label || "Community invite"} · share this page, text the code{" "}
                <strong>{code.toUpperCase()}</strong>, or scan the QR below.
              </p>
            </div>

            <CommunityCover community={community} />

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How this invite works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-fg-muted">
                  <p>
                    1. Create your Neighborly account (email, Google, or X).
                  </p>
                  <p>
                    2. Build a short profile — skills, interests, whether you're new
                    or offering youth services.
                  </p>
                  <p>
                    3. {community.name} is pre-selected. You can also join church, HOA,
                    school, or vacation communities in the same step.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild>
                      <Link
                        to="/signup"
                        search={{ community: community.slug, code: code.toUpperCase() }}
                      >
                        Accept & create account
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link to="/c/$slug" params={{ slug: community.slug }}>
                        Preview community first
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col items-center text-center">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-center gap-2 text-base">
                    <QrCode className="h-4 w-4" /> Mailbox QR
                  </CardTitle>
                  <CardDescription>Print or screenshot for flyers</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={`QR code for ${community.name} invite`}
                      width={180}
                      height={180}
                      className="rounded-[var(--radius-md)] border border-border bg-white p-2"
                      crossOrigin="anonymous"
                    />
                  ) : null}
                  <p className="font-mono text-sm font-semibold tracking-wide text-fg">
                    {code.toUpperCase()}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (navigator.share && joinUrl) {
                        await navigator.share({
                          title: `Join ${community.name} on Neighborly`,
                          text: `Use code ${code.toUpperCase()} to join ${community.name}`,
                          url: joinUrl,
                        });
                      } else if (joinUrl) {
                        await navigator.clipboard.writeText(joinUrl);
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share invite
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
