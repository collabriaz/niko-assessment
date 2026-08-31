export const WORK_ORDER_STATUSES = [
  "draft",
  "assigned",
  "travelling",
  "on_site",
  "blocked",
  "completed",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const FITTER_STATUSES = [
  "assigned",
  "travelling",
  "on_site",
  "blocked",
  "completed",
] as const;

const TRANSITIONS: Record<string, WorkOrderStatus[]> = {
  draft: ["assigned"],
  assigned: ["travelling", "on_site", "blocked"],
  travelling: ["on_site", "blocked"],
  on_site: ["blocked", "completed"],
  blocked: ["travelling", "on_site", "completed"],
  completed: [],
};

export const nextStatuses = (from: string) => TRANSITIONS[from] ?? [];

export const transitionAllowed = (from: string, to: WorkOrderStatus) =>
  nextStatuses(from).includes(to);

export const statusBlockers = (
  status: WorkOrderStatus,
  note: string | null,
  proofCount: number,
) => {
  const missing: string[] = [];

  if (status === "blocked" && !note?.trim()) missing.push("a reason");

  if (status === "completed") {
    if (!note?.trim()) missing.push("a completion note");
    if (proofCount < 1) missing.push("at least one proof attachment");
  }

  return missing;
};

export const isClientVisibleStatus = (status: WorkOrderStatus) =>
  status === "completed";
