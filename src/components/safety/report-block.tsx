import { useState } from "react";
import { Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  REPORT_REASONS,
  blockUser,
  submitSafetyReport,
  type SafetyContentType,
} from "@/lib/community/safety";

export function ReportBlockControls({
  contentType,
  contentId,
  reportedUserId,
  reportedUserName,
  contentExcerpt,
  allowBlock = false,
  onBlocked,
}: {
  contentType: SafetyContentType;
  contentId?: string;
  reportedUserId?: string;
  reportedUserName?: string;
  contentExcerpt?: string;
  allowBlock?: boolean;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const canBlock = allowBlock && Boolean(reportedUserId);

  async function onSubmit() {
    setBusy(true);
    try {
      const res = await submitSafetyReport({
        data: {
          contentType,
          contentId,
          reportedUserId,
          contentExcerpt,
          reason,
          details,
          alsoBlock: alsoBlock && canBlock,
        },
      });
      toast.success(
        res.blocked
          ? "Report submitted. You will no longer see this person."
          : "Report submitted. Lincoln will review it on the ops desk.",
      );
      setOpen(false);
      setDetails("");
      setAlsoBlock(false);
      if (res.blocked) onBlocked?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }

  async function onBlock() {
    if (!reportedUserId) return;
    const ok = window.confirm(
      `Block ${reportedUserName || "this neighbor"}? You will stop seeing their posts. You can undo this in Profile & alerts.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await blockUser({ data: { userId: reportedUserId } });
      toast.success("Blocked. They will leave your feed.");
      onBlocked?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not block");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Flag className="mr-1 h-3.5 w-3.5" />
        Report
      </Button>
      {canBlock && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void onBlock();
          }}
        >
          <Ban className="mr-1 h-3.5 w-3.5" />
          Block
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report</DialogTitle>
            <DialogDescription>
              Reports are private. They go to the owner ops desk for review — this is not
              911. If someone is in immediate danger, call local emergency services or 988.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Why are you reporting this?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="neighborly-report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="report-details">Anything we should know? (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
          {canBlock && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
              />
              Also block {reportedUserName || "this person"} so they leave my feed.
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
              {busy ? "Sending…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
