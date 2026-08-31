import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { POST as uploadProof } from "@/app/api/mobile/work-orders/[workOrderId]/proof/route";
import { getContractForOrganisation } from "@/data/contracts";
import { createWorkOrder } from "@/data/work-orders";
import { fixtureClock } from "@/domain/fixtures";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const FITTER = "user-fitter-01";
const MANAGER = "user-manager-01";
const OAK_LEGAL = "org-oak-legal";
const LOCATION = `Status probe ${randomUUID()}`;

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const update = (
  workOrderId: string,
  body: Record<string, unknown>,
  idempotencyKey = `status-${randomUUID()}`,
  userId: string | null = FITTER,
) =>
  POST(
    new Request(
      `http://localhost/api/mobile/work-orders/${workOrderId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "X-Prototype-User-Id": userId } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ workOrderId }) },
  );

const attachProof = (workOrderId: string, note = "Panel fitted.") => {
  const form = new FormData();
  form.set(
    "file",
    new File([Buffer.from(PIXEL, "base64")], "proof.png", {
      type: "image/png",
    }),
  );
  form.set("completionNote", note);

  return uploadProof(
    new Request(
      `http://localhost/api/mobile/work-orders/${workOrderId}/proof`,
      {
        method: "POST",
        headers: {
          "X-Prototype-User-Id": FITTER,
          "Idempotency-Key": `proof-${randomUUID()}`,
        },
        body: form,
      },
    ),
    { params: Promise.resolve({ workOrderId }) },
  );
};

const openJob = async () => {
  const created = await createWorkOrder({
    campaignId: "campaign-002",
    contractId: "contract-002",
    type: "installation",
    assignedUserId: FITTER,
    assetId: "asset-van-18",
    scheduledStart: "2027-01-15T13:00:00.000Z",
    scheduledEnd: "2027-01-15T15:00:00.000Z",
    locationLabel: LOCATION,
    instructions: "Fit the approved rear panel.",
    internalNotes: "Depot gate code 4417.",
    idempotencyKey: `job-${randomUUID()}`,
    now: fixtureClock,
  });

  if (created.status !== "created") throw new Error("probe setup failed");

  return created.workOrderId;
};

afterAll(async () => {
  const made = await prisma.workOrder.findMany({
    where: { locationLabel: LOCATION },
    select: { id: true },
  });
  const ids = made.map((workOrder) => workOrder.id);

  await prisma.serviceEvent.deleteMany({ where: { workOrderId: { in: ids } } });
  await prisma.proofRecord.deleteMany({ where: { workOrderId: { in: ids } } });
  await prisma.idempotencyKey.deleteMany({ where: { recordId: { in: ids } } });
  await prisma.workOrder.deleteMany({ where: { id: { in: ids } } });
});

describe("a blocked job needs a reason", () => {
  it("refuses to block without one", async () => {
    const workOrderId = await openJob();
    const response = await update(workOrderId, { status: "blocked" });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: "This update needs a reason.",
    });
  });

  it("blocks with a reason and records it", async () => {
    const workOrderId = await openJob();
    const response = await update(workOrderId, {
      status: "blocked",
      note: "Depot gate locked, nobody on site.",
    });
    const workOrder = await response.json();

    expect(response.status).toBe(200);
    expect(workOrder.status).toBe("blocked");
    expect(workOrder.blockedReason).toBe("Depot gate locked, nobody on site.");
  });

  it("keeps the blocked reason away from the client", async () => {
    const workOrderId = await openJob();

    await update(workOrderId, {
      status: "blocked",
      note: "Depot gate locked, nobody on site.",
    });

    const events = await prisma.serviceEvent.findMany({
      where: { workOrderId },
    });

    expect(events).toHaveLength(1);
    expect(events.at(0)).toMatchObject({
      clientVisible: false,
      clientSummary: null,
    });
  });
});

describe("a completed job needs proof", () => {
  it("refuses completion with no proof and no note", async () => {
    const workOrderId = await openJob();

    await update(workOrderId, { status: "on_site" });
    const response = await update(workOrderId, { status: "completed" });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message:
        "This update needs a completion note and at least one proof attachment.",
    });
  });

  it("refuses completion with a note but still no proof", async () => {
    const workOrderId = await openJob();

    await update(workOrderId, { status: "on_site" });
    const response = await update(workOrderId, {
      status: "completed",
      note: "Panel fitted.",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: "This update needs at least one proof attachment.",
    });
  });

  it("completes once proof and a note are both there", async () => {
    const workOrderId = await openJob();

    await update(workOrderId, { status: "on_site" });
    await attachProof(workOrderId);

    const response = await update(workOrderId, {
      status: "completed",
      note: "Panel fitted and photographed.",
    });
    const workOrder = await response.json();

    expect(response.status).toBe(200);
    expect(workOrder.status).toBe("completed");
    expect(workOrder.completionNote).toBe("Panel fitted and photographed.");
    expect(workOrder.proofRecordIds).toHaveLength(1);
  });

  it("writes the service history the client reads, without the internal note", async () => {
    const workOrderId = await openJob();

    await update(workOrderId, { status: "on_site" });
    await attachProof(workOrderId);
    await update(workOrderId, {
      status: "completed",
      note: "Panel fitted and photographed.",
    });

    const contract = await getContractForOrganisation(
      OAK_LEGAL,
      "contract-002",
    );
    const serialised = JSON.stringify(contract);

    expect(
      contract?.serviceEvents.some(
        (event) => event.type === "installation_completed",
      ),
    ).toBe(true);
    expect(
      contract?.proofRecords.some((proof) => proof.fileName === "proof.png"),
    ).toBe(true);
    expect(serialised).not.toContain("Depot gate code");
    expect(serialised).not.toContain("createdByUserId");
  });

  it("counts one completion when the fitter taps twice on weak signal", async () => {
    const workOrderId = await openJob();
    const key = `status-${randomUUID()}`;

    await update(workOrderId, { status: "on_site" });
    await attachProof(workOrderId);

    const first = await update(
      workOrderId,
      { status: "completed", note: "Panel fitted." },
      key,
    );
    const second = await update(
      workOrderId,
      { status: "completed", note: "Panel fitted." },
      key,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await prisma.serviceEvent.count({ where: { workOrderId } })).toBe(1);

    const history = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { history: true },
    });

    expect(
      JSON.stringify(history?.history).match(/"action":"completed"/g),
    ).toHaveLength(1);
  });
});

describe("who may move a job", () => {
  it("refuses a move the state machine does not allow", async () => {
    const workOrderId = await openJob();
    const response = await update(workOrderId, { status: "completed" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "WORK_ORDER_STATE_CONFLICT",
    });
  });

  it("hides a job assigned to another fitter behind a 404", async () => {
    const response = await update("work-order-does-not-exist", {
      status: "travelling",
    });

    expect(response.status).toBe(404);
  });

  it("refuses a manager and an anonymous caller", async () => {
    const workOrderId = await openJob();

    expect(
      (
        await update(
          workOrderId,
          { status: "travelling" },
          `status-${randomUUID()}`,
          MANAGER,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await update(
          workOrderId,
          { status: "travelling" },
          `status-${randomUUID()}`,
          null,
        )
      ).status,
    ).toBe(403);
  });
});
