import { randomUUID } from "node:crypto";
import { historyEntrySchema } from "../domain/schemas";
import {
  isClientVisibleStatus,
  statusBlockers,
  transitionAllowed,
  type WorkOrderStatus,
} from "../domain/work-orders";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";

type WorkOrderRow = {
  id: string;
  campaignId: string;
  contractId: string;
  organisationId: string;
  assetId: string;
  assignedUserId: string | null;
  type: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  locationLabel: string;
  instructions: string;
  completionNote: string | null;
  blockedReason: string | null;
  history: unknown;
  proofRecords: { id: string }[];
};

export const WORK_ORDER_INCLUDE = {
  proofRecords: { select: { id: true } },
};

export const toWorkOrder = (workOrder: WorkOrderRow) => ({
  id: workOrder.id,
  campaignId: workOrder.campaignId,
  contractId: workOrder.contractId,
  organisationId: workOrder.organisationId,
  assetId: workOrder.assetId,
  assignedUserId: workOrder.assignedUserId,
  type: workOrder.type,
  status: workOrder.status,
  scheduledStart: workOrder.scheduledStart.toISOString(),
  scheduledEnd: workOrder.scheduledEnd.toISOString(),
  locationLabel: workOrder.locationLabel,
  instructions: workOrder.instructions,
  completionNote: workOrder.completionNote,
  blockedReason: workOrder.blockedReason,
  proofRecordIds: workOrder.proofRecords.map((proof) => proof.id),
  history: workOrder.history,
});

export const listUpcomingWorkOrders = async (now: Date, take: number) => {
  const workOrders = await prisma.workOrder.findMany({
    where: { scheduledEnd: { gte: now }, status: { not: "completed" } },
    include: WORK_ORDER_INCLUDE,
    orderBy: { scheduledStart: "asc" },
    take,
  });

  return workOrders.map(toWorkOrder);
};

const MANAGEMENT_ACTOR = "manager";
const UNACCEPTED_CAMPAIGN_STATUS = "awaiting_contract_acceptance";
const FITTER_ROLE = "fitter";

const ASSIGNED_INCLUDE = {
  ...WORK_ORDER_INCLUDE,
  asset: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
};

type AssignedRow = WorkOrderRow & {
  internalNotes: string | null;
  asset: { id: string; name: string };
  campaign: { id: string; name: string };
};

export const toAssignedWorkOrder = (workOrder: AssignedRow) => ({
  ...toWorkOrder(workOrder),
  internalNotes: workOrder.internalNotes,
  assetName: workOrder.asset.name,
  campaignName: workOrder.campaign.name,
});

type CreateWorkOrderInput = {
  campaignId: string;
  contractId: string;
  type: string;
  assignedUserId: string;
  assetId: string;
  scheduledStart: string;
  scheduledEnd: string;
  locationLabel: string;
  instructions: string;
  internalNotes: string | null;
  idempotencyKey: string;
  now: Date;
};

export const createWorkOrder = (input: CreateWorkOrderInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.workOrderCreate,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen)
      return { status: "existing", workOrderId: seen.recordId } as const;

    const campaign = await tx.campaign.findUnique({
      where: { id: input.campaignId },
    });

    if (!campaign) return { status: "unknown_campaign" } as const;

    if (campaign.contractId !== input.contractId)
      return { status: "contract_mismatch" } as const;

    if (campaign.status === UNACCEPTED_CAMPAIGN_STATUS)
      return { status: "campaign_not_accepted" } as const;

    const asset = await tx.asset.findUnique({ where: { id: input.assetId } });

    if (!asset) return { status: "unknown_asset" } as const;

    const fitter = await tx.user.findUnique({
      where: { id: input.assignedUserId },
    });

    if (fitter?.role !== FITTER_ROLE)
      return { status: "not_a_fitter" } as const;

    const workOrder = await tx.workOrder.create({
      data: {
        id: `work-order-${randomUUID()}`,
        campaignId: campaign.id,
        contractId: campaign.contractId,
        organisationId: campaign.organisationId,
        assetId: input.assetId,
        assignedUserId: input.assignedUserId,
        type: input.type,
        status: "assigned",
        scheduledStart: new Date(input.scheduledStart),
        scheduledEnd: new Date(input.scheduledEnd),
        locationLabel: input.locationLabel,
        instructions: input.instructions,
        internalNotes: input.internalNotes,
        history: [
          {
            at: input.now.toISOString(),
            actor: MANAGEMENT_ACTOR,
            action: "assigned",
            note: `Assigned to ${fitter.name}.`,
          },
        ],
      },
    });

    await tx.idempotencyKey.create({
      data: { ...key, recordId: workOrder.id },
    });

    return { status: "created", workOrderId: workOrder.id } as const;
  });

export const listWorkOrdersForManagement = async () => {
  const workOrders = await prisma.workOrder.findMany({
    include: {
      ...ASSIGNED_INCLUDE,
      organisation: { select: { name: true } },
      assignedUser: { select: { name: true } },
    },
    orderBy: { scheduledStart: "asc" },
  });

  return workOrders.map((workOrder) => ({
    ...toAssignedWorkOrder(workOrder),
    organisationName: workOrder.organisation.name,
    assignedUserName: workOrder.assignedUser?.name ?? null,
  }));
};

export const getWorkOrderForManagement = async (workOrderId: string) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      ...ASSIGNED_INCLUDE,
      organisation: { select: { id: true, name: true } },
      assignedUser: { select: { name: true } },
      serviceEvents: { orderBy: { at: "asc" } },
    },
  });

  if (!workOrder) return null;

  const proofRecords = await prisma.proofRecord.findMany({
    where: { workOrderId },
    orderBy: { createdAt: "asc" },
  });

  return {
    ...toAssignedWorkOrder(workOrder),
    organisationId: workOrder.organisation.id,
    organisationName: workOrder.organisation.name,
    assignedUserName: workOrder.assignedUser?.name ?? null,
    serviceEvents: workOrder.serviceEvents.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      type: event.type,
      title: event.title,
      clientVisible: event.clientVisible,
      clientSummary: event.clientSummary,
    })),
    proofRecords: proofRecords.map((proof) => ({
      id: proof.id,
      fileName: proof.fileName,
      previewUrl: proof.previewUrl,
      completionNote: proof.completionNote,
      createdAt: proof.createdAt.toISOString(),
      createdByUserId: proof.createdByUserId,
    })),
  };
};

const FITTER_ACTOR = "fitter";
const COMPLETION_SUMMARY = "Work has been completed and photographed.";

const completedTitle = (type: string) =>
  `${type.charAt(0).toUpperCase()}${type.slice(1)} completed`;

export const listWorkOrdersForFitter = async (
  assignedUserId: string,
  status?: string,
) => {
  const workOrders = await prisma.workOrder.findMany({
    where: { assignedUserId, status },
    include: ASSIGNED_INCLUDE,
    orderBy: { scheduledStart: "asc" },
  });

  return workOrders.map(toAssignedWorkOrder);
};

export const getWorkOrderForFitter = async (
  workOrderId: string,
  assignedUserId: string,
) => {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, assignedUserId },
    include: ASSIGNED_INCLUDE,
  });

  return workOrder ? toAssignedWorkOrder(workOrder) : null;
};

type StatusInput = {
  workOrderId: string;
  userId: string;
  status: WorkOrderStatus;
  note: string | null;
  idempotencyKey: string;
  now: Date;
};

export const applyStatusUpdate = (input: StatusInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.workOrderStatus,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen) return { status: "existing" } as const;

    const workOrder = await tx.workOrder.findFirst({
      where: { id: input.workOrderId, assignedUserId: input.userId },
      include: { proofRecords: { select: { id: true } } },
    });

    if (!workOrder) return { status: "not_found" } as const;

    if (!transitionAllowed(workOrder.status, input.status))
      return { status: "wrong_state", from: workOrder.status } as const;

    const missing = statusBlockers(
      input.status,
      input.note,
      workOrder.proofRecords.length,
    );

    if (missing.length > 0) return { status: "missing", missing } as const;

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: input.status,
        blockedReason: input.status === "blocked" ? input.note : null,
        completionNote:
          input.status === "completed" ? input.note : workOrder.completionNote,
        history: [
          ...historyEntrySchema.array().parse(workOrder.history),
          {
            at: input.now.toISOString(),
            actor: FITTER_ACTOR,
            action: input.status,
            note: input.note,
          },
        ],
      },
    });

    if (input.status === "completed" || input.status === "blocked")
      await tx.serviceEvent.create({
        data: {
          organisationId: workOrder.organisationId,
          contractId: workOrder.contractId,
          campaignId: workOrder.campaignId,
          workOrderId: workOrder.id,
          at: input.now,
          type:
            input.status === "completed"
              ? `${workOrder.type}_completed`
              : `${workOrder.type}_blocked`,
          title:
            input.status === "completed"
              ? completedTitle(workOrder.type)
              : "Job blocked",
          clientVisible: isClientVisibleStatus(input.status),
          clientSummary: isClientVisibleStatus(input.status)
            ? COMPLETION_SUMMARY
            : null,
        },
      });

    await tx.idempotencyKey.create({
      data: { ...key, recordId: workOrder.id },
    });

    return { status: "updated" } as const;
  });

type ProofInput = {
  workOrderId: string;
  userId: string;
  fileName: string;
  previewUrl: string;
  completionNote: string;
  idempotencyKey: string;
  now: Date;
};

export const createProof = (input: ProofInput) =>
  prisma.$transaction(async (tx) => {
    const key = {
      scope: IDEMPOTENCY_SCOPE.workOrderProof,
      key: input.idempotencyKey,
    };
    const seen = await tx.idempotencyKey.findUnique({
      where: { scope_key: key },
    });

    if (seen) return { status: "existing", proofId: seen.recordId } as const;

    const workOrder = await tx.workOrder.findFirst({
      where: { id: input.workOrderId, assignedUserId: input.userId },
    });

    if (!workOrder) return { status: "not_found" } as const;

    if (workOrder.status === "completed")
      return { status: "already_completed" } as const;

    const proof = await tx.proofRecord.create({
      data: {
        workOrderId: workOrder.id,
        createdByUserId: input.userId,
        fileName: input.fileName,
        previewUrl: input.previewUrl,
        completionNote: input.completionNote,
        createdAt: input.now,
      },
    });

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        history: [
          ...historyEntrySchema.array().parse(workOrder.history),
          {
            at: input.now.toISOString(),
            actor: FITTER_ACTOR,
            action: "proof_uploaded",
            note: input.fileName,
          },
        ],
      },
    });

    await tx.idempotencyKey.create({ data: { ...key, recordId: proof.id } });

    return { status: "created", proofId: proof.id } as const;
  });
