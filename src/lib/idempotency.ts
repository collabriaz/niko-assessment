export const IDEMPOTENCY_SCOPE = {
  register: "auth.register",
  bookingRequest: "booking-request.create",
  clientContractAction: "client-contract.action",
  contractCreate: "contract.create",
  contractIssue: "contract.issue",
  workOrderCreate: "work-order.create",
  workOrderStatus: "work-order.status",
  workOrderProof: "work-order.proof",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
