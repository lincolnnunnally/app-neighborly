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
  listMyIncomingInquiries,
} from "@/lib/community/server";
import {
  SERVICE_CATEGORIES,
  serviceCategoryLabel,
  type Membership,
  type Service,
  type ServiceInquiry,
} from "@/lib/community/types";

type ServicesSearch = { register?: string };

export const Route = createFileRoute("/app/services")({
  validateSearch: (s: Record<string, unknown>): ServicesSearch => ({
    register: typeof s.register === "string" ? s.register : undefined,
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const user = useCurrentUser();
  const search = Route.useSearch();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [inquiries, setInquiries] = useState<ServiceInquiry[]>([]);
  const [showForm, setShowForm] = useState(search.register === "1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("household");
  const [pricing, setPricing] = useState("paid");
  const [priceNote, setPriceNote] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [isYouth, setIsYouth] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [makerBio, setMakerBio] = useState("");

  async function reload(mid?: string) {
    const [m, incoming] = await Promise.all([getMyMemberships(), listMyIncomingInquiries()]);
    setMemberships(m);
    setInquiries(incoming);
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

  useEffect(() => {
    if (search.register === "1") setShowForm(true);
  }, [search.register]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Services & businesses</h1>
          <p className="text-sm text-fg-muted">
            Tennis coaching, a restaurant karaoke night, a kid offering lawn work, or a
            maker listing handmade work — post it free. Neighbors message you here. No
            payments yet.
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
                  photo_url: photoUrl,
                  portfolio_url: portfolioUrl,
                  maker_bio: makerBio,
                },
              });
              toast.success("Service listed");
              setShowForm(false);
              setTitle("");
              setDescription("");
              setPhotoUrl("");
              setPortfolioUrl("");
              setMakerBio("");
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
          <div className="space-y-1.5">
            <Label>About you / the work (optional)</Label>
            <Textarea
              value={makerBio}
              onChange={(e) => setMakerBio(e.target.value)}
              placeholder="Shop name, materials, years making, who you serve…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Photo URL (optional)</Label>
              <Input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Portfolio / shop link (optional)</Label>
              <Input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
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

      {inquiries.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Messages about your listings</h2>
          {inquiries.map((i) => (
            <article key={i.id} className="surface-card p-4">
              <p className="text-sm font-medium">
                {i.inquirer_name} on “{i.service_title}”
              </p>
              <p className="mt-1 text-sm text-fg-muted">{i.message}</p>
            </article>
          ))}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <article key={s.id} className="surface-card p-4">
            {s.photo_url ? (
              <img
                src={s.photo_url}
                alt=""
                className="mb-3 h-36 w-full rounded-[var(--radius-md)] object-cover"
              />
            ) : null}
            <div className="mb-2 flex flex-wrap gap-2">
              {s.is_business && <Badge>Business</Badge>}
              {s.is_youth && <Badge variant="accent">Youth</Badge>}
              <Badge variant="outline">{s.pricing}</Badge>
              <Badge variant="secondary">{serviceCategoryLabel(s.category)}</Badge>
            </div>
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
            {s.maker_bio ? <p className="mt-2 text-sm text-fg">{s.maker_bio}</p> : null}
            <p className="mt-2 text-xs text-fg-subtle">
              {s.provider_name}
              {s.price_note ? ` · ${s.price_note}` : ""}
              {s.portfolio_url ? " · portfolio linked" : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
