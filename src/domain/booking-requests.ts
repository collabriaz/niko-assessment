const DAY_MS = 86_400_000;

export const MANAGEMENT_DECISIONS = [
  "request_information",
  "approve",
  "decline",
] as const;

export type ManagementDecision = (typeof MANAGEMENT_DECISIONS)[number];

const OPEN_STATUSES = ["submitted", "information_required"];

export const decisionAllowed = (status: string) =>
  OPEN_STATUSES.includes(status);

export const decidedStatus = {
  request_information: "information_required",
  approve: "approved",
  decline: "declined",
} as const;

export const decisionNeedsNote = (action: ManagementDecision) =>
  action !== "approve";

const termDays = (startDate: string, endDate: string) =>
  (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS;

export const shortTermWarning = (
  startDate: string,
  endDate: string,
  minimumTermDays: number,
) => {
  const days = termDays(startDate, endDate);

  return days < minimumTermDays
    ? `${days} of ${minimumTermDays} day minimum term`
    : null;
};

type RequestAttention = {
  status: string;
  startDate: string;
  endDate: string;
  minimumTermDays: number;
  draftContractId: string | null;
};

export const attentionReason = (request: RequestAttention) => {
  if (request.status === "submitted") {
    const shortfall = shortTermWarning(
      request.startDate,
      request.endDate,
      request.minimumTermDays,
    );

    return shortfall
      ? `Awaiting decision. ${shortfall}.`
      : "Awaiting decision.";
  }

  if (request.status === "information_required")
    return "Waiting on the client to reply.";

  if (request.status === "approved" && !request.draftContractId)
    return "Approved. Needs a draft contract.";

  return null;
};
