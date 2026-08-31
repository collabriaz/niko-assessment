import { humanise } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-info-surface text-info",
  change_requested: "bg-warning-surface text-warning",
  accepted: "bg-success-surface text-success",
  active: "bg-success-surface text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive-surface text-destructive",
};

const LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued for review",
  change_requested: "Changes requested",
  accepted: "Accepted",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const StatusBadge = ({
  status,
  className,
}: {
  status: string;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
      TONE[status] ?? "bg-muted text-muted-foreground",
      className,
    )}
  >
    {LABEL[status] ?? humanise(status)}
  </span>
);
