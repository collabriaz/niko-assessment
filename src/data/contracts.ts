import type { ContractItem } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";

const toItem = (item: ContractItem) => ({
  id: item.id,
  productId: item.productId,
  assetId: item.assetId,
  capacityPoolId: item.capacityPoolId,
  quantity: item.quantity,
  unitRate: item.unitRate === null ? null : Number(item.unitRate),
  rateUnit: item.rateUnit,
  lineTotal: Number(item.lineTotal),
});

export const listContractsForOrganisation = async (organisationId: string) => {
  const contracts = await prisma.contract.findMany({
    where: { organisationId },
    include: { items: true },
    orderBy: { startDate: "desc" },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    organisationId: contract.organisationId,
    bookingRequestId: contract.bookingRequestId,
    status: contract.status,
    version: contract.version,
    startDate: dateOnly(contract.startDate),
    endDate: dateOnly(contract.endDate),
    currency: contract.currency,
    total: Number(contract.total),
    issuedAt: contract.issuedAt?.toISOString() ?? null,
    acceptedAt: contract.acceptedAt?.toISOString() ?? null,
    activatedAt: contract.activatedAt?.toISOString() ?? null,
    items: contract.items.map(toItem),
    history: contract.history,
  }));
};

export const getContractForOrganisation = async (
  organisationId: string,
  contractId: string,
) => {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organisationId },
    include: {
      items: true,
      campaigns: true,
      clientRequests: { orderBy: { createdAt: "asc" } },
      serviceEvents: { where: { clientVisible: true }, orderBy: { at: "asc" } },
    },
  });

  if (!contract) return null;

  const proofRecords = await prisma.proofRecord.findMany({
    where: { workOrder: { contractId, organisationId } },
    orderBy: { createdAt: "asc" },
  });

  const campaign = contract.campaigns.at(0) ?? null;

  return {
    id: contract.id,
    organisationId: contract.organisationId,
    bookingRequestId: contract.bookingRequestId,
    status: contract.status,
    version: contract.version,
    startDate: dateOnly(contract.startDate),
    endDate: dateOnly(contract.endDate),
    currency: contract.currency,
    total: Number(contract.total),
    issuedAt: contract.issuedAt?.toISOString() ?? null,
    acceptedAt: contract.acceptedAt?.toISOString() ?? null,
    activatedAt: contract.activatedAt?.toISOString() ?? null,
    items: contract.items.map(toItem),
    history: contract.history,
    campaign,
    serviceEvents: contract.serviceEvents.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      type: event.type,
      title: event.title,
      clientVisible: event.clientVisible,
      clientSummary: event.clientSummary,
    })),
    proofRecords: proofRecords.map((proof) => ({
      ...proof,
      createdAt: proof.createdAt.toISOString(),
    })),
    clientRequests: contract.clientRequests.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
    })),
  };
};
