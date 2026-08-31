import { randomUUID } from "node:crypto";
import {
  checkAssetAvailability,
  checkProductAvailability,
} from "../domain/availability";
import {
  attentionReason,
  decidedStatus,
  decisionAllowed,
  type ManagementDecision,
} from "../domain/booking-requests";
import { historyEntrySchema } from "../domain/schemas";
import type { AvailabilitySummary } from "../domain/types";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";
import { calendarDate, dateOnly } from "./dates";
import { ORGANISATION_INCLUDE, toOrganisation } from "./organisations";
import {
  type ProductRow,
  toAvailabilityInventory,
  toSearchResult,
  withInventory,
} from "./products";

const REQUEST_INCLUDE = { contracts: { select: { id: true }, take: 1 } };

type RequestRow = {
  id: string;
  organisationId: string;
  productId: string;
  requestedAssetId: string | null;
  startDate: Date;
  endDate: Date;
  budget: unknown;
  objective: string;
  notes: string | null;
  status: string;
  createdAt: Date;
  history: unknown;
  contracts: { id: string }[];
};

const toBookingRequest = (request: RequestRow) => ({
  id: request.id,
  organisationId: request.organisationId,
  productId: request.productId,
  requestedAssetId: request.requestedAssetId,
  startDate: dateOnly(request.startDate),
  endDate: dateOnly(request.endDate),
  budget: request.budget === null ? null : Number(request.budget),
  objective: request.objective,
  notes: request.notes,
  status: request.status,
  createdAt: request.createdAt.toISOString(),
  draftContractId: request.contracts.at(0)?.id ?? null,
  history: request.history,
});

type CreateInput = {
  userId: string;
  idempotencyKey: string;
  now: Date;
  productId: string;
  requestedAssetId: string | null;
  startDate: string;
  endDate: string;
  budget: number;
  objective: string;
  notes: string | null;
};

export const createBookingRequest = (input: CreateInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.bookingRequest,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen) {
      const existing = await tx.bookingRequest.findUnique({
        where: { id: seen.recordId },
        include: REQUEST_INCLUDE,
      });

      return existing
        ? ({ status: "existing", request: toBookingRequest(existing) } as const)
        : ({ status: "unknown_product" } as const);
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      include: { organisation: true },
    });

    if (!user?.organisation) return { status: "forbidden" } as const;

    const product = await tx.product.findUnique({
      where: { id: input.productId },
      include: { assets: { select: { id: true } } },
    });

    if (!product) return { status: "unknown_product" } as const;

    if (
      input.requestedAssetId &&
      !product.assets.some((asset) => asset.id === input.requestedAssetId)
    )
      return { status: "asset_mismatch" } as const;

    const request = await tx.bookingRequest.create({
      data: {
        id: `request-${randomUUID()}`,
        organisationId: user.organisation.id,
        productId: input.productId,
        requestedAssetId: input.requestedAssetId,
        advertiserName: user.organisation.name,
        advertiserContactName: user.name,
        advertiserEmail: user.email,
        startDate: calendarDate(input.startDate),
        endDate: calendarDate(input.endDate),
        budget: input.budget,
        objective: input.objective,
        notes: input.notes,
        status: "submitted",
        createdAt: input.now,
        history: [
          {
            at: input.now.toISOString(),
            actor: "client",
            action: "submitted",
            note: null,
          },
        ],
      },
      include: REQUEST_INCLUDE,
    });

    await tx.idempotencyKey.create({ data: { ...key, recordId: request.id } });

    return { status: "created", request: toBookingRequest(request) } as const;
  });

const MANAGEMENT_ACTOR = "manager";

const MANAGEMENT_INCLUDE = {
  ...REQUEST_INCLUDE,
  organisation: { include: ORGANISATION_INCLUDE },
  product: { include: withInventory },
};

type ManagementRow = RequestRow & {
  organisation: {
    id: string;
    name: string;
    createdAt: Date;
    _count: { contracts: number };
  };
  product: ProductRow;
};

const requestAvailability = (
  product: ProductRow,
  assetId: string | null,
  startDate: string,
  endDate: string,
  now: Date,
): AvailabilitySummary => {
  const inventory = toAvailabilityInventory(product);
  const asset = inventory.assets.find((candidate) => candidate.id === assetId);

  if (asset)
    return checkAssetAvailability({
      asset,
      bookings: inventory.bookings,
      holds: inventory.holds,
      outages: inventory.outages,
      startDate,
      endDate,
      now,
    });

  return checkProductAvailability({
    product: {
      id: product.id,
      allocationModel: product.allocationModel,
      capacityPoolId: product.capacityPool?.id ?? null,
    },
    ...inventory,
    startDate,
    endDate,
    now,
  });
};

const toManagementDetail = (request: ManagementRow, now: Date) => {
  const startDate = dateOnly(request.startDate);
  const endDate = dateOnly(request.endDate);
  const draftContractId = request.contracts.at(0)?.id ?? null;

  return {
    ...toBookingRequest(request),
    organisation: toOrganisation(request.organisation),
    product: toSearchResult(request.product, startDate, endDate, now),
    currentAvailability: requestAvailability(
      request.product,
      request.requestedAssetId,
      startDate,
      endDate,
      now,
    ),
    attentionReason: attentionReason({
      status: request.status,
      startDate,
      endDate,
      minimumTermDays: request.product.minimumTermDays,
      draftContractId,
    }),
  };
};

export const listBookingRequestsForManagement = async (status?: string) => {
  const requests = await prisma.bookingRequest.findMany({
    where: { status },
    include: {
      ...REQUEST_INCLUDE,
      organisation: { select: { name: true } },
      product: { select: { name: true, minimumTermDays: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests
    .map((request) => {
      const startDate = dateOnly(request.startDate);
      const endDate = dateOnly(request.endDate);

      return {
        id: request.id,
        organisationId: request.organisationId,
        organisationName: request.organisation.name,
        productName: request.product.name,
        startDate,
        endDate,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        draftContractId: request.contracts.at(0)?.id ?? null,
        attentionReason: attentionReason({
          status: request.status,
          startDate,
          endDate,
          minimumTermDays: request.product.minimumTermDays,
          draftContractId: request.contracts.at(0)?.id ?? null,
        }),
      };
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.attentionReason)) - Number(Boolean(a.attentionReason)),
    );
};

export const getBookingRequestForManagement = async (
  requestId: string,
  now: Date,
) => {
  const request = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: MANAGEMENT_INCLUDE,
  });

  return request ? toManagementDetail(request, now) : null;
};

const approvalNote = (
  note: string | null,
  availability: AvailabilitySummary,
) =>
  availability.state === "confirmation_required"
    ? `${note ? `${note} ` : ""}Approved subject to confirmation: ${availability.reason}`
    : note;

const selectionNote = (note: string | null, assetId: string | null) =>
  assetId ? `${note ? `${note} ` : ""}Allocated ${assetId}.` : note;

type DecisionInput = {
  requestId: string;
  action: ManagementDecision;
  note: string | null;
  selectedAssetId: string | null;
  now: Date;
};

export const applyManagementDecision = (input: DecisionInput) =>
  prisma.$transaction(async (tx) => {
    const request = await tx.bookingRequest.findUnique({
      where: { id: input.requestId },
      include: { product: { include: withInventory } },
    });

    if (!request) return { status: "not_found" } as const;

    if (!decisionAllowed(request.status))
      return { status: "already_decided" } as const;

    const assetId = input.selectedAssetId ?? request.requestedAssetId;

    if (
      assetId &&
      !request.product.assets.some((asset) => asset.id === assetId)
    )
      return { status: "asset_mismatch" } as const;

    let note = input.note;

    if (input.action === "approve") {
      const availability = requestAvailability(
        request.product,
        assetId,
        dateOnly(request.startDate),
        dateOnly(request.endDate),
        input.now,
      );

      if (availability.state === "unavailable")
        return {
          status: "inventory_conflict",
          reason: availability.reason,
        } as const;

      note = approvalNote(
        selectionNote(note, input.selectedAssetId),
        availability,
      );
    }

    await tx.bookingRequest.update({
      where: { id: request.id },
      data: {
        status: decidedStatus[input.action],
        history: [
          ...historyEntrySchema.array().parse(request.history),
          {
            at: input.now.toISOString(),
            actor: MANAGEMENT_ACTOR,
            action: input.action,
            note,
          },
        ],
      },
    });

    return { status: "decided" } as const;
  });
