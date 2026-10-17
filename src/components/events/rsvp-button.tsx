import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cancelNeighborRsvp, getRsvpState, rsvpNeighborEvent } from "@/lib/community/event-detail";
import { cn } from "@/lib/utils";

function goingLine(count: number, going: boolean): string {
  if (going) return count > 1 ? `You and ${count - 1} ${count - 1 === 1 ? "neighbor" : "neighbors"} are going` : "You're going";
  if (count > 1) return `${count} neighbors are going`;
  if (count === 1) return "One neighbor is going";
  return "Be one of the first";
}

/**
 * Real RSVP for a neighbor-board gathering. Signed-out visitors go to sign in
 * and come back to the event page, where the RSVP is finished for them.
 */
export function RsvpButton({
  eventId,
  initialCount = 0,
  autoConfirm = false,
  showCount = true,
  className,
}: {
  eventId: string;
  initialCount?: number;
  autoConfirm?: boolean;
  showCount?: boolean;
  className?: string;
}) {
  const id = eventId.replace(/^board:/, "");
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [count, setCount] = useState(initialCount);
  const [going, setGoing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoDone, setAutoDone] = useState(false);

  useEffect(() => {
    if (isPending) return;
    let live = true;
    getRsvpState({ data: id })
      .then((s) => {
        if (!live) return;
        setCount(s.count);
        setGoing(s.going);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id, isPending, user?.id]);

  async function rsvp() {
    if (!user) {
      const back = `/e/${encodeURIComponent(`board:${id}`)}?rsvp=1`;
      await navigate({ to: "/login", search: { redirect: back } as never });
      return;
    }
    setBusy(true);
    try {
      const r = await rsvpNeighborEvent({ data: id });
      if (!r.ok && r.needsProfile) {
        toast("Add your name first, then you're on the list.");
        await navigate({ to: "/onboarding" });
        return;
      }
      setGoing(true);
      setCount(r.count);
      toast.success("You're on the list. See you there!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const r = await cancelNeighborRsvp({ data: id });
      setGoing(false);
      setCount(r.count);
      toast("Okay — you're off the list.");
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoConfirm && user && !isPending && !autoDone && !going) {
      setAutoDone(true);
      void rsvp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirm, user?.id, isPending, going]);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {going ? (
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary bg-primary-soft px-4 text-base font-semibold text-primary"
          aria-label="You're going. Tap to cancel."
        >
          <Check className="h-4 w-4" aria-hidden />
          Going
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void rsvp()}
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-base font-semibold text-primary-fg"
        >
          {busy ? "Saving…" : "I'll be there"}
        </button>
      )}
      {showCount && (
        <span className="text-base text-fg-muted" aria-live="polite">
          {goingLine(count, going)}
        </span>
      )}
    </div>
  );
}
