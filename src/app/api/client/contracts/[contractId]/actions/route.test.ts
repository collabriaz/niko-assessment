import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const suffix = randomUUID();
const ORG = `org-probe-${suffix}`;
const USER = `user-probe-${suffix}`;
const OTHER_CLIENT = "user-client-lighthouse";
const MANAGER = "user-manager-01";

const contractId = (name: string) => `contract-probe-${name}-${suffix}`;

const makeContract = async (
  name: string,
  startDate: string,
  endDate: string,
) => {
  const id = contractId(name);

  await prisma.contract.create({
    data: {
      id,
      organisationId: ORG,
      status: "issued",
      version: 1,
      startDate: new Date(`${startDate}T00:00:00Z`),
      endDate: new Date(`${endDate}T00:00:00Z`),
      currency: "GBP",
      total: 950,
      issuedAt: new Date("2027-01-15T09:00:00Z"),
      history: [],
      items: {
        create: {
          id: `item-${name}-${suffix}`,
          productId: "product-bus-rear",
          assetId: "asset-bus-101-rear",
          quantity: 1,
          unitRate: 950,
          rateUnit: "month",
          lineTotal: 950,
        },
      },
      campaigns: {
        create: {
          id: `campaign-${name}-${suffix}`,
          organisationId: ORG,
          name: `Probe campaign ${name}`,
          status: "awaiting_contract_acceptance",
          currentStage: "contract_issued",
          clientVisible: true,
        },
      },
    },
  });

  return id;
};

const act = (
  id: string,
  body: unknown,
  key?: string,
  userId: string | null = USER,
) =>
  POST(
    new Request(`http://localhost/api/client/contracts/${id}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-Prototype-User-Id": userId } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ contractId: id }) },
  );

beforeAll(async () => {
  await prisma.organisation.create({
    data: {
      id: ORG,
      name: `Probe Co ${suffix}`,
      createdAt: new Date("2027-01-15T09:00:00Z"),
    },
  });
  await prisma.user.create({
    data: {
      id: USER,
      name: "Probe Client",
      email: `probe-${suffix}@example.test`,
      role: "client",
      organisationId: ORG,
      status: "active",
    },
  });

  await makeContract("accept", "2027-08-01", "2027-09-01");
  await makeContract("changes", "2027-08-01", "2027-09-01");
  await makeContract("cancel", "2027-08-01", "2027-09-01");
  await makeContract("conflict", "2027-02-01", "2027-03-01");
});

afterAll(async () => {
  await prisma.serviceEvent.deleteMany({ where: { organisationId: ORG } });
  await prisma.clientRequest.deleteMany({ where: { organisationId: ORG } });
  await prisma.campaign.deleteMany({ where: { organisationId: ORG } });
  await prisma.booking.deleteMany({
    where: { campaignName: { contains: "Probe campaign" } },
  });
  await prisma.contractItem.deleteMany({
    where: { contract: { organisationId: ORG } },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: { contains: suffix } },
  });
  await prisma.contract.deleteMany({ where: { organisationId: ORG } });
  await prisma.user.deleteMany({ where: { organisationId: ORG } });
  await prisma.organisation.deleteMany({ where: { id: ORG } });
});

describe("accepting a contract", () => {
  const id = contractId("accept");
  const key = `probe-accept-${suffix}`;

  it("accepts, records history and confirms the inventory", async () => {
    const response = await act(id, { action: "accept" }, key);
    const contract = await response.json();

    expect(response.status).toBe(200);
    expect(contract.status).toBe("accepted");
    expect(contract.acceptedAt).toBe("2027-01-15T09:00:00.000Z");
    expect(contract.activatedAt).toBeNull();
    expect(contract.history.at(-1)).toMatchObject({
      actor: "client",
      action: "accept",
    });

    const booking = await prisma.booking.findFirst({
      where: { campaignName: `Probe campaign accept` },
    });
    expect(booking?.status).toBe("confirmed");
    expect(booking?.assetId).toBe("asset-bus-101-rear");
  });

  it("activates the connected campaign and links the booking", async () => {
    const campaign = await prisma.campaign.findFirst({
      where: { contractId: id },
    });

    expect(campaign?.status).toBe("scheduled");
    expect(campaign?.currentStage).toBe("contract_accepted");
    expect(campaign?.bookingId).not.toBeNull();
  });

  it("adds a client-visible service event", async () => {
    const event = await prisma.serviceEvent.findFirst({
      where: { contractId: id, type: "contract_accepted" },
    });

    expect(event?.clientVisible).toBe(true);
    expect(event?.clientSummary).toBe(
      "Your advertising contract has been accepted.",
    );
  });

  it("returns the same result for a repeated idempotency key", async () => {
    const response = await act(id, { action: "accept" }, key);

    expect(response.status).toBe(200);
    expect(
      await prisma.booking.count({
        where: { campaignName: "Probe campaign accept" },
      }),
    ).toBe(1);
  });

  it("refuses a second acceptance under a new key", async () => {
    const response = await act(
      id,
      { action: "accept" },
      `probe-accept-again-${suffix}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTRACT_STATE_CONFLICT",
    });
  });
});

describe("requesting changes", () => {
  it("records the request without rewriting the contract", async () => {
    const id = contractId("changes");
    const before = await prisma.contract.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });

    const response = await act(
      id,
      {
        action: "request_changes",
        note: "Please move the start to September.",
      },
      `probe-changes-${suffix}`,
    );
    const contract = await response.json();

    expect(response.status).toBe(200);
    expect(contract.status).toBe("change_requested");

    const after = await prisma.contract.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });

    expect(after.version).toBe(before.version);
    expect(Number(after.total)).toBe(Number(before.total));
    expect(after.startDate).toEqual(before.startDate);
    expect(after.endDate).toEqual(before.endDate);
    expect(after.items).toEqual(before.items);

    const request = await prisma.clientRequest.findFirst({
      where: { contractId: id },
    });
    expect(request?.type).toBe("contract_change");
    expect(request?.status).toBe("submitted");
    expect(request?.summary).toBe("Please move the start to September.");
  });
});

describe("requesting cancellation", () => {
  it("leaves the contract alone and stays pending review", async () => {
    const id = contractId("cancel");

    const response = await act(
      id,
      { action: "request_cancellation", note: "Budget was pulled." },
      `probe-cancel-${suffix}`,
    );
    const contract = await response.json();

    expect(response.status).toBe(200);
    expect(contract.status).toBe("issued");

    const request = await prisma.clientRequest.findFirst({
      where: { contractId: id, type: "contract_cancellation" },
    });
    expect(request?.status).toBe("submitted");
  });
});

describe("acceptance rechecks inventory", () => {
  it("refuses when the asset was taken after the contract was issued", async () => {
    const response = await act(
      contractId("conflict"),
      { action: "accept" },
      `probe-conflict-${suffix}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVENTORY_CONFLICT",
    });
  });
});

describe("refusals", () => {
  it("rejects a missing idempotency key", async () => {
    expect((await act(contractId("cancel"), { action: "accept" })).status).toBe(
      422,
    );
  });

  it("rejects an unknown action", async () => {
    const response = await act(
      contractId("cancel"),
      { action: "delete_everything" },
      `probe-bad-${suffix}`,
    );

    expect(response.status).toBe(422);
  });

  it("hides the contract from another organisation", async () => {
    const response = await act(
      contractId("cancel"),
      { action: "accept" },
      `probe-other-${suffix}`,
      OTHER_CLIENT,
    );

    expect(response.status).toBe(404);
  });

  it("refuses a user who is not a client", async () => {
    const response = await act(
      contractId("cancel"),
      { action: "accept" },
      `probe-manager-${suffix}`,
      MANAGER,
    );

    expect(response.status).toBe(403);
  });
});
