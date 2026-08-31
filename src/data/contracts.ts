import { randomUUID } from "node:crypto";
import type { ContractItem } from "@prisma/client";
import { contractIssuable, contractTotal } from "../domain/contracts";
import { historyEntrySchema } from "../domain/schemas";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";
import { calendarDate, dateOnly } from "./dates";

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

const CONTRACT_CURRENCY = "GBP";
const MANAGEMENT_ACTOR = "manager";
const APPROVED_REQUEST_STATUS = "approved";
const REPLACEABLE_CONTRACT_STATUS = "cancelled";

const ISSUED_EVENT = {
  type: "contract_issued",
  title: "Contract ready for review",
  clientSummary: "Your contract is ready to review.",
};

type DraftItem = {
  productId: string;
  assetId: string | null;
  capacityPoolId: string | null;
  quantity: number;
  unitRate: number | null;
  rateUnit: string | null;
  lineTotal: number;
};

type DraftInput = {
  organisationId: string;
  bookingRequestId: string;
  startDate: string;
  endDate: string;
  items: DraftItem[];
  idempotencyKey: string;
  now: Date;
};

export const createDraftContract = (input: DraftInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.contractCreate,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen) return { status: "existing", contractId: seen.recordId } as const;

    const request = await tx.bookingRequest.findUnique({
      where: { id: input.bookingRequestId },
      include: {
        contracts: { select: { id: true, status: true } },
        product: { select: { id: true, assets: { select: { id: true } } } },
      },
    });

    if (!request) return { status: "unknown_request" } as const;

    if (request.organisationId !== input.organisationId)
      return { status: "organisation_mismatch" } as const;

    if (request.status !== APPROVED_REQUEST_STATUS)
      return { status: "not_approved", requestStatus: request.status } as const;

    if (
      request.contracts.some(
        (contract) => contract.status !== REPLACEABLE_CONTRACT_STATUS,
      )
    )
      return { status: "already_drafted" } as const;

    const wrongProduct = input.items.find(
      (item) => item.productId !== request.productId,
    );

    if (wrongProduct) return { status: "product_mismatch" } as const;

    const wrongAsset = input.items.find(
      (item) =>
        item.assetId &&
        !request.product.assets.some((asset) => asset.id === item.assetId),
    );

    if (wrongAsset) return { status: "asset_mismatch" } as const;

    const contract = await tx.contract.create({
      data: {
        id: `contract-${randomUUID()}`,
        organisationId: input.organisationId,
        bookingRequestId: input.bookingRequestId,
        status: "draft",
        version: 1,
        startDate: calendarDate(input.startDate),
        endDate: calendarDate(input.endDate),
        currency: CONTRACT_CURRENCY,
        total: contractTotal(input.items.map((item) => item.lineTotal)),
        history: [
          {
            at: input.now.toISOString(),
            actor: MANAGEMENT_ACTOR,
            action: "draft_created",
            note: null,
          },
        ],
        items: {
          create: input.items.map((item) => ({
            id: `contract-item-${randomUUID()}`,
            productId: item.productId,
            assetId: item.assetId,
            capacityPoolId: item.capacityPoolId,
            quantity: item.quantity,
            unitRate: item.unitRate,
            rateUnit: item.rateUnit,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });

    await tx.idempotencyKey.create({ data: { ...key, recordId: contract.id } });

    return { status: "created", contractId: contract.id } as const;
  });

type IssueInput = {
  contractId: string;
  idempotencyKey: string;
  now: Date;
};

export const issueContract = (input: IssueInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.contractIssue,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen) return { status: "existing" } as const;

    const contract = await tx.contract.findUnique({
      where: { id: input.contractId },
      include: {
        campaigns: { select: { id: true } },
        organisation: { select: { name: true } },
      },
    });

    if (!contract) return { status: "not_found" } as const;

    if (!contractIssuable(contract.status))
      return {
        status: "wrong_state",
        contractStatus: contract.status,
      } as const;

    await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "issued",
        issuedAt: input.now,
        history: [
          ...historyEntrySchema.array().parse(contract.history),
          {
            at: input.now.toISOString(),
            actor: MANAGEMENT_ACTOR,
            action: "issued",
            note: "Issued for client review.",
          },
        ],
      },
    });

    const campaignId =
      contract.campaigns.at(0)?.id ?? `campaign-${randomUUID()}`;

    if (!contract.campaigns.at(0))
      await tx.campaign.create({
        data: {
          id: campaignId,
          organisationId: contract.organisationId,
          contractId: contract.id,
          name: `${contract.organisation.name} campaign`,
          status: "awaiting_contract_acceptance",
          currentStage: "contract_issued",
          clientVisible: true,
        },
      });

    await tx.serviceEvent.create({
      data: {
        organisationId: contract.organisationId,
        contractId: contract.id,
        campaignId,
        at: input.now,
        clientVisible: true,
        ...ISSUED_EVENT,
      },
    });

    await tx.idempotencyKey.create({ data: { ...key, recordId: contract.id } });

    return { status: "issued" } as const;
  });

export const listContractsForManagement = async () => {
  const contracts = await prisma.contract.findMany({
    include: { organisation: { select: { name: true } } },
    orderBy: { startDate: "desc" },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    organisationId: contract.organisationId,
    organisationName: contract.organisation.name,
    status: contract.status,
    startDate: dateOnly(contract.startDate),
    endDate: dateOnly(contract.endDate),
    currency: contract.currency,
    total: Number(contract.total),
  }));
};

export const getContractForManagement = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      items: true,
      organisation: { select: { id: true, name: true } },
      campaigns: { include: { booking: true } },
      bookingRequest: { select: { id: true } },
    },
  });

  if (!contract) return null;

  const campaign = contract.campaigns.at(0) ?? null;

  return {
    id: contract.id,
    organisationId: contract.organisationId,
    organisationName: contract.organisation.name,
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
    campaign: campaign && {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      currentStage: campaign.currentStage,
      bookingId: campaign.bookingId,
      bookingStatus: campaign.booking?.status ?? null,
    },
  };
};
