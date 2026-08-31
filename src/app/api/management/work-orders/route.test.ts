import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const MANAGER = "user-manager-01";
const FITTER = "user-fitter-01";
const CLIENT = "user-client-oaklegal";
const LOCATION = `Probe depot ${randomUUID()}`;

const create = (
  payload: unknown,
  idempotencyKey?: string,
  userId: string | null = MANAGER,
) =>
  POST(
    new Request("http://localhost/api/management/work-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-Prototype-User-Id": userId } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    }),
  );

const body = {
  campaignId: "campaign-002",
  contractId: "contract-002",
  type: "installation",
  assignedUserId: FITTER,
  assetId: "asset-van-14",
  scheduledStart: "2027-01-20T13:00:00Z",
  scheduledEnd: "2027-01-20T15:00:00Z",
  locationLabel: LOCATION,
  instructions: "Fit the approved rear panel and photograph the result.",
  internalNotes: "Gate code is on the depot sheet.",
};

afterAll(async () => {
  const made = await prisma.workOrder.findMany({
    where: { locationLabel: LOCATION },
    select: { id: true },
  });
  const ids = made.map((workOrder) => workOrder.id);

  await prisma.serviceEvent.deleteMany({ where: { workOrderId: { in: ids } } });
  await prisma.proofRecord.deleteMany({ where: { workOrderId: { in: ids } } });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: { in: ids } },
  });
  await prisma.workOrder.deleteMany({ where: { id: { in: ids } } });
});

describe("POST /api/management/work-orders", () => {
  it("creates a job assigned to the fitter", async () => {
    const response = await create(body, `wo-${randomUUID()}`);
    const workOrder = await response.json();

    expect(response.status).toBe(201);
    expect(workOrder).toMatchObject({
      status: "assigned",
      type: "installation",
      assignedUserId: FITTER,
      organisationId: "org-oak-legal",
    });
    expect(workOrder.history.at(-1)).toMatchObject({
      actor: "manager",
      action: "assigned",
    });
  });

  it("returns the same job for a repeated idempotency key", async () => {
    const key = `wo-${randomUUID()}`;

    const first = await create(body, key);
    const second = await create(body, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).id).toBe((await first.json()).id);
  });

  it("refuses a campaign the client has not accepted yet", async () => {
    const response = await create(
      {
        ...body,
        campaignId: "campaign-001",
        contractId: "contract-001",
        assetId: "asset-door-b",
      },
      `wo-${randomUUID()}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CAMPAIGN_STATE_CONFLICT",
    });
  });

  it("refuses to assign work to someone who is not a fitter", async () => {
    const response = await create(
      { ...body, assignedUserId: MANAGER },
      `wo-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });

  it("refuses a campaign that belongs to another contract", async () => {
    const response = await create(
      { ...body, contractId: "contract-001" },
      `wo-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });

  it("refuses an end before its start, an unknown type and a missing key", async () => {
    expect(
      (
        await create(
          { ...body, scheduledEnd: "2027-01-15T12:00:00Z" },
          `wo-${randomUUID()}`,
        )
      ).status,
    ).toBe(422);
    expect(
      (await create({ ...body, type: "rewiring" }, `wo-${randomUUID()}`))
        .status,
    ).toBe(422);
    expect((await create(body)).status).toBe(422);
  });

  it("refuses a fitter, a client and an anonymous caller", async () => {
    for (const userId of [FITTER, CLIENT, null])
      expect((await create(body, `wo-${randomUUID()}`, userId)).status).toBe(
        403,
      );
  });
});
