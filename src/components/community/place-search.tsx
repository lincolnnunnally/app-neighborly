import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlaceSearch({
  defaultValue = "",
  size = "md",
}: {
  defaultValue?: string;
  size?: "md" | "lg";
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultValue);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      setError("Type a 5-digit ZIP or City, ST.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/near?q=${encodeURIComponent(query)}`);
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        community?: { slug: string };
      };
      if (!res.ok || !d.ok || !d.community?.slug) {
        setError(d.error || "Could not find that place.");
        return;
      }
      await navigate({ to: "/weekend", search: { place: d.community.slug } });
    } catch {
      setError("Could not look that up. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-xl space-y-2">
      <div className={size === "lg" ? "flex flex-col gap-2 sm:flex-row" : "flex gap-2"}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ZIP or City, ST — e.g. 30474 or Vidalia, GA"
          aria-label="City or ZIP"
          className={size === "lg" ? "h-12 text-base" : ""}
        />
        <Button type="submit" disabled={busy} size={size === "lg" ? "lg" : "default"}>
          {busy ? "Looking…" : "What's going on"}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
