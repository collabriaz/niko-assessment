import type { AvailabilityState } from "@/domain/types";
import { cn } from "@/lib/utils";

const STYLE: Record<AvailabilityState, string> = {
  available: "bg-success-surface text-success",
  confirmation_required: "bg-warning-surface text-warning",
  unavailable: "bg-destructive-surface text-destructive",
};

const LABEL: Record<AvailabilityState, string> = {
  available: "Available",
  confirmation_required: "Confirm with owner",
  unavailable: "Not available",
};

export const AvailabilityBadge = ({
  state,
  className,
}: {
  state: AvailabilityState;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
      STYLE[state],
      className,
    )}
  >
    {LABEL[state]}
  </span>
);
