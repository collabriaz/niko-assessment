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
