import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  createService,
  getCommunityFeed,
  getMyMemberships,
} from "@/lib/community/server";
import {
  SERVICE_CATEGORIES,
  type Membership,
  type Service,
} from "@/lib/community/types";

export const Route = createFileRoute("/app/services")({
  component: ServicesPage,
});

function ServicesPage() {
  const user = useCurrentUser();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("household");
  const [pricing, setPricing] = useState("paid");
  const [priceNote, setPriceNote] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [isYouth, setIsYouth] = useState(false);

  async function reload(mid?: string) {
    const m = await getMyMemberships();
    setMemberships(m);
    const primary = m.find((x) => x.is_primary) ?? m[0];
    const id = mid || communityId || primary?.community_id || "";
    setCommunityId(id);
    const slug = m.find((x) => x.community_id === id)?.community?.slug;
    if (!slug) return;
    const feed = await getCommunityFeed({ data: { slug, userId: user?.id } });
    setServices(feed.services);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Services & businesses</h1>
          <p className="text-sm text-fg-muted">
            Local pros, side hustles, and kids earning for good work.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Register a service"}
        </Button>
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

      {showForm && (
        <form
          className="surface-card space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createService({
                data: {
                  communityId,
                  title,
                  description,
                  category,
                  pricing,
                  price_note: priceNote,
                  is_business: isBusiness,
                  is_youth: isYouth,
                },
              });
              toast.success("Service listed");
              setShowForm(false);
              setTitle("");
              setDescription("");
              await reload(communityId);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Service title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lawn mowing, handyman, tutoring…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you offer, when you're available, experience…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pricing model</Label>
              <Select value={pricing} onValueChange={setPricing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="tip">Tips welcome</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Price note</Label>
            <Input
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              placeholder="$25/hr · free estimates · trade OK"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isBusiness} onCheckedChange={(v) => setIsBusiness(Boolean(v))} />
            Registered local business
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isYouth} onCheckedChange={(v) => setIsYouth(Boolean(v))} />
            Youth / kids service (parents should know)
          </label>
          <Button type="submit">Publish service</Button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <article key={s.id} className="surface-card p-4">
            <div className="mb-2 flex flex-wrap gap-2">
              {s.is_business && <Badge>Business</Badge>}
              {s.is_youth && <Badge variant="accent">Youth</Badge>}
              <Badge variant="outline">{s.pricing}</Badge>
            </div>
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
            <p className="mt-2 text-xs text-fg-subtle">
              {s.provider_name}
              {s.price_note ? ` · ${s.price_note}` : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
