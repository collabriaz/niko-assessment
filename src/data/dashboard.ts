import { attentionReason } from "../domain/booking-requests";
import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";
import { listUpcomingWorkOrders } from "./work-orders";

const OPEN_REQUEST_STATUSES = ["submitted", "information_required"];
const PENDING_CLIENT_REQUEST_STATUSES = ["submitted", "in_review"];
const AWAITING_CLIENT_STATUSES = ["issued", "change_requested"];
const UPCOMING_WORK_ORDER_LIMIT = 5;

export const getManagementDashboard = async (now: Date) => {
  const [
    openRequests,
    pendingClientRequests,
    contractsAwaitingClient,
    blockedWorkOrders,
    upcomingWorkOrders,
  ] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: { status: { in: OPEN_REQUEST_STATUSES } },
      include: {
        contracts: { select: { id: true }, take: 1 },
        organisation: { select: { name: true } },
        product: { select: { name: true, minimumTermDays: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clientRequest.findMany({
      where: { status: { in: PENDING_CLIENT_REQUEST_STATUSES } },
      include: { organisation: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contract.count({
      where: { status: { in: AWAITING_CLIENT_STATUSES } },
    }),
    prisma.workOrder.count({ where: { status: "blocked" } }),
    listUpcomingWorkOrders(now, UPCOMING_WORK_ORDER_LIMIT),
  ]);

  const requestItems = openRequests.map((request) => ({
    id: request.id,
    kind: "booking_request",
    title: `${request.organisation.name} wants ${request.product.name}`,
    detail:
      attentionReason({
        status: request.status,
        startDate: dateOnly(request.startDate),
        endDate: dateOnly(request.endDate),
        minimumTermDays: request.product.minimumTermDays,
        draftContractId: request.contracts.at(0)?.id ?? null,
      }) ?? "Awaiting decision.",
    href: `/manage/requests/${request.id}`,
  }));

  const clientRequestItems = pendingClientRequests.map((request) => ({
    id: request.id,
    kind: "client_request",
    title: `${request.organisation.name} asked for a change`,
    detail: request.summary,
    href: request.contractId
      ? `/manage/contracts/${request.contractId}`
      : `/manage/clients/${request.organisationId}`,
  }));

  return {
    attentionItems: [...requestItems, ...clientRequestItems],
    counts: {
      requestsAwaitingDecision: openRequests.length,
      clientRequestsPending: pendingClientRequests.length,
      contractsAwaitingClient,
      workOrdersBlocked: blockedWorkOrders,
      workOrdersUpcoming: upcomingWorkOrders.length,
    },
    upcomingWorkOrders,
  };
};
