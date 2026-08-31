export const CLIENT_ACTIONS = [
  "accept",
  "request_changes",
  "request_cancellation",
] as const;

export type ClientAction = (typeof CLIENT_ACTIONS)[number];

const LIVE_STATUSES = ["issued", "change_requested", "accepted", "active"];

export const clientActionRequired = (status: string) =>
  status === "issued" ? "Review and accept or request changes" : null;

export const clientActionAllowed = (status: string, action: ClientAction) =>
  action === "request_cancellation"
    ? LIVE_STATUSES.includes(status)
    : status === "issued";

export const acceptedContractStatus = (startDate: string, now: Date) =>
  startDate <= now.toISOString().slice(0, 10) ? "active" : "accepted";

export const acceptedCampaignStage = (contractStatus: string) => ({
  status: contractStatus === "active" ? "active" : "scheduled",
  currentStage: "contract_accepted",
});

const PENCE = 100;

export const contractTotal = (lineTotals: number[]) =>
  Math.round(lineTotals.reduce((sum, line) => sum + line, 0) * PENCE) / PENCE;

export const contractIssuable = (status: string) => status === "draft";

export const MANAGEMENT_CONTRACT_ACTIONS = [
  "re_issue",
  "cancel",
  "complete",
] as const;

export type ManagementContractAction =
  (typeof MANAGEMENT_CONTRACT_ACTIONS)[number];

const MANAGEMENT_ACTION_FROM: Record<ManagementContractAction, string[]> = {
  re_issue: ["change_requested"],
  cancel: ["draft", "issued", "change_requested", "accepted", "active"],
  complete: ["active"],
};

export const managementActionAllowed = (
  status: string,
  action: ManagementContractAction,
) => MANAGEMENT_ACTION_FROM[action].includes(status);

export const managementActionStatus = {
  re_issue: "issued",
  cancel: "cancelled",
  complete: "completed",
} as const;

export const releasesInventory = (action: ManagementContractAction) =>
  action === "cancel";
