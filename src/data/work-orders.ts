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
