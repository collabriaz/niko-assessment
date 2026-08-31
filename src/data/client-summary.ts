import { clientActionRequired } from "../domain/contracts";
import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";

const RECENT_SERVICE_EVENTS = 6;

export const getClientSummary = async (organisationId: string) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    include: {
      contracts: { orderBy: { startDate: "desc" } },
      clientRequests: {
        where: { status: "submitted" },
        orderBy: { createdAt: "desc" },
      },
      serviceEvents: {
        where: { clientVisible: true },
        orderBy: { at: "desc" },
        take: RECENT_SERVICE_EVENTS,
      },
      bookingRequests: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organisation) return null;

  const contracts = organisation.contracts.map((contract) => ({
    id: contract.id,
    status: contract.status,
    startDate: dateOnly(contract.startDate),
    endDate: dateOnly(contract.endDate),
    total: Number(contract.total),
    actionRequired: clientActionRequired(contract.status),
  }));

  return {
    organisation: {
      id: organisation.id,
      name: organisation.name,
      createdAt: organisation.createdAt.toISOString(),
      contractCount: organisation.contracts.length,
    },
    contracts,
    attentionItems: [
      ...contracts
        .filter((contract) => contract.actionRequired !== null)
        .map((contract) => ({
          type: "contract_awaiting_response",
          contractId: contract.id,
          title: "A contract is ready for your review",
          detail: contract.actionRequired,
        })),
      ...organisation.clientRequests.map((request) => ({
        type: "request_pending_review",
        contractId: request.contractId,
        title: "Your request is with Island Media Co",
        detail: request.summary,
      })),
    ],
    bookingRequests: organisation.bookingRequests.map((request) => ({
      id: request.id,
      productName: request.product.name,
      startDate: dateOnly(request.startDate),
      endDate: dateOnly(request.endDate),
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
    recentServiceEvents: organisation.serviceEvents.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      type: event.type,
      title: event.title,
      clientVisible: event.clientVisible,
      clientSummary: event.clientSummary,
    })),
  };
};
