import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPersonalInvite,
  getMyMemberships,
} from "@/lib/community/server";
import type { Membership } from "@/lib/community/types";

export const Route = createFileRoute("/app/invite")({
  component: InvitePage,
});

function InvitePage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    getMyMemberships().then((m) => {
      setMemberships(m);
      const primary = m.find((x) => x.is_primary) ?? m[0];
      if (primary) {
        setCommunityId(primary.community_id);
        setCode(primary.community?.invite_code ?? "");
      }
    });
  }, []);

  const community = memberships.find((m) => m.community_id === communityId)?.community;
  const joinUrl = origin && code ? `${origin}/join/${encodeURIComponent(code)}` : "";
  const qrSrc = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=14&data=${encodeURIComponent(joinUrl)}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Invite neighbors</h1>
        <p className="text-sm text-fg-muted">
          Text, email, Facebook, YouTube, or a QR on the mailbox.
        </p>
      </div>

      {memberships.length > 0 && (
        <Select
          value={communityId}
          onValueChange={(v) => {
            setCommunityId(v);
            const c = memberships.find((m) => m.community_id === v)?.community;
            setCode(c?.invite_code ?? "");
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shareable link & code</CardTitle>
            <CardDescription>
              Works in a text thread, church bulletin, or social post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[var(--radius-md)] border border-border bg-bg p-3 font-mono text-sm break-all">
              {joinUrl || "…"}
            </div>
            <p className="text-sm">
              Code:{" "}
              <strong className="font-mono tracking-wide">{code || "—"}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (!joinUrl) return;
                  await navigator.clipboard.writeText(joinUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-4 w-4" /> Copy link
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!code) return;
                  await navigator.clipboard.writeText(code);
                  toast.success("Code copied");
                }}
              >
                Copy code
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!communityId) return;
                  try {
                    const inv = await createPersonalInvite({
                      data: {
                        communityId,
                        label: `Invite from neighbor`,
                      },
                    });
                    setCode(inv.code);
                    toast.success("Personal invite created");
                  } catch {
                    toast.error("Could not create invite");
                  }
                }}
              >
                New personal code
              </Button>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4 text-sm text-fg-muted">
              <p className="font-medium text-fg">Suggested message</p>
              <p className="mt-2">
                Join me on Neighborly for {community?.name ?? "our community"} —
                needs, events, local help, and facilities. Code {code || "…"}. {joinUrl}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-4 w-4" /> Printable QR flyer
            </CardTitle>
            <CardDescription>
              Screenshot or print for mailboxes, porches, and bulletin boards.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="Community invite QR"
                width={200}
                height={200}
                className="rounded-[var(--radius-lg)] border border-border bg-white p-3"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="h-[200px] w-[200px] animate-pulse rounded-[var(--radius-lg)] bg-bg-subtle" />
            )}
            <div>
              <p className="font-display text-lg font-semibold">
                {community?.name ?? "Community"}
              </p>
              <p className="text-sm text-fg-muted">Scan to join on Neighborly</p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-wide">{code}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
