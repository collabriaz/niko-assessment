import { randomUUID } from "node:crypto";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";
import { calendarDate, dateOnly } from "./dates";

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
