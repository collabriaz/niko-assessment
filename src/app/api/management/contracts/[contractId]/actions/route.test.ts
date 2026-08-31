import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as clientContract } from "@/app/api/client/contracts/[contractId]/route";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const MANAGER = "user-manager-01";
const suffix = randomUUID();
const ORG = `org-mgmt-probe-${suffix}`;
const USER = `user-mgmt-probe-${suffix}`;

const contractId = (name: string) => `contract-mgmt-${name}-${suffix}`;

const act = (
  id: string,
  body: unknown,
  key?: string,
  userId: string | null = MANAGER,
) =>
  POST(
    new Request(`http://localhost/api/management/contracts/${id}/actions`, {
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

const CANCEL_START = "2029-01-01";
const CANCEL_END = "2029-02-01";

const makeContract = async (
  name: string,
  status: string,
  startDate = "2027-08-01",
  endDate = "2027-09-01",
) => {
  const id = contractId(name);

  await prisma.contract.create({
    data: {
      id,
      organisationId: ORG,
      status,
      version: 1,
      startDate: new Date(`${startDate}T00:00:00Z`),
      endDate: new Date(`${endDate}T00:00:00Z`),
      currency: "GBP",
      total: 950,
      issuedAt: new Date("2027-01-15T09:00:00Z"),
      history: [],
    },
  });

  return id;
};

beforeAll(async () => {
  await prisma.organisation.create({
    data: {
      id: ORG,
      name: `Mgmt Probe ${suffix}`,
      createdAt: new Date("2027-01-15T09:00:00Z"),
    },
  });
  await prisma.user.create({
    data: {
      id: USER,
      name: "Probe Client",
      email: `mgmt-probe-${suffix}@example.test`,
      role: "client",
      organisationId: ORG,
      status: "active",
    },
  });

  await makeContract("reissue", "change_requested");
  await makeContract("cancel", "active", CANCEL_START, CANCEL_END);
  await makeContract("complete", "active");
  await makeContract("draft", "draft");
});

afterAll(async () => {
  await prisma.serviceEvent.deleteMany({ where: { organisationId: ORG } });
  await prisma.clientRequest.deleteMany({ where: { organisationId: ORG } });
  await prisma.booking.deleteMany({
    where: { campaignName: { contains: suffix } },
  });
  await prisma.campaign.deleteMany({ where: { organisationId: ORG } });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: { contains: suffix } },
  });
  await prisma.contract.deleteMany({ where: { organisationId: ORG } });
  await prisma.user.deleteMany({ where: { organisationId: ORG } });
  await prisma.organisation.deleteMany({ where: { id: ORG } });
});

describe("re-issuing a contract the client asked to change", () => {
  it("raises the version, returns it to the client and resolves the request", async () => {
    const id = contractId("reissue");

    const request = await prisma.clientRequest.create({
      data: {
        organisationId: ORG,
        contractId: id,
        type: "contract_change",
        status: "submitted",
        summary: "Please move the start date.",
        createdAt: new Date("2027-01-15T09:00:00Z"),
        history: [],
      },
    });

    const response = await act(
      id,
      { action: "re_issue", note: "Start date agreed by phone." },
      `reissue-${randomUUID()}`,
    );

    expect(response.status).toBe(200);

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id } });

    expect(contract.status).toBe("issued");
    expect(contract.version).toBe(2);

    const resolved = await prisma.clientRequest.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(resolved.status).toBe("resolved");
  });

  it("leaves the line items and total exactly as issued", async () => {
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: contractId("reissue") },
      include: { items: true },
    });

    expect(Number(contract.total)).toBe(950);
    expect(contract.items).toEqual([]);
  });
});

describe("cancelling a contract", () => {
  it("releases the booked inventory rather than leaving the asset held", async () => {
    const id = contractId("cancel");

    const booking = await prisma.booking.create({
      data: {
        id: `booking-mgmt-${suffix}`,
        campaignName: `Probe campaign ${suffix}`,
        productId: "product-bus-rear",
        assetId: "asset-bus-101-rear",
        startDate: new Date(`${CANCEL_START}T00:00:00Z`),
        endDate: new Date(`${CANCEL_END}T00:00:00Z`),
        status: "confirmed",
      },
    });

    await prisma.campaign.create({
      data: {
        id: `campaign-mgmt-cancel-${suffix}`,
        organisationId: ORG,
        contractId: id,
        bookingId: booking.id,
        name: `Probe campaign ${suffix}`,
        status: "active",
        currentStage: "contract_accepted",
        clientVisible: true,
      },
    });

    const response = await act(
      id,
      { action: "cancel", note: "Client withdrew." },
      `cancel-${randomUUID()}`,
    );

    expect(response.status).toBe(200);

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id } });
    const released = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    const campaign = await prisma.campaign.findFirstOrThrow({
      where: { contractId: id },
    });

    expect(contract.status).toBe("cancelled");
    expect(released.status).toBe("cancelled");
    expect(campaign.status).toBe("cancelled");
  });
});

describe("completing a contract", () => {
  it("moves an active contract to completed", async () => {
    const response = await act(
      contractId("complete"),
      { action: "complete", note: null },
      `complete-${randomUUID()}`,
    );

    expect(response.status).toBe(200);
    expect(
      (
        await prisma.contract.findUniqueOrThrow({
          where: { id: contractId("complete") },
        })
      ).status,
    ).toBe("completed");
  });
});

describe("what the client is told", () => {
  it("adds a client-visible event without the manager's internal note", async () => {
    const body = await (
      await clientContract(
        new Request(
          `http://localhost/api/client/contracts/${contractId("cancel")}`,
          { headers: { "X-Prototype-User-Id": USER } },
        ),
        { params: Promise.resolve({ contractId: contractId("cancel") }) },
      )
    ).json();

    const event = body.serviceEvents.find(
      (item: { type: string }) => item.type === "contract_cancelled",
    );

    expect(event.clientSummary).toBe("Your contract has been cancelled.");
    expect(JSON.stringify(body.serviceEvents)).not.toContain("Client withdrew");
  });
});

describe("refusals", () => {
  it("refuses an action the contract's state does not allow", async () => {
    const response = await act(
      contractId("draft"),
      { action: "re_issue", note: null },
      `bad-${randomUUID()}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTRACT_STATE_CONFLICT",
    });
  });

  it("acts once for a repeated idempotency key", async () => {
    const id = contractId("draft");
    const key = `repeat-${randomUUID()}`;

    expect((await act(id, { action: "cancel", note: null }, key)).status).toBe(
      200,
    );
    expect((await act(id, { action: "cancel", note: null }, key)).status).toBe(
      200,
    );

    const events = await prisma.serviceEvent.count({
      where: { contractId: id, type: "contract_cancelled" },
    });

    expect(events).toBe(1);
  });

  it("rejects an unknown action and a missing key", async () => {
    expect(
      (
        await act(
          contractId("complete"),
          { action: "shred", note: null },
          `bad-${randomUUID()}`,
        )
      ).status,
    ).toBe(422);
    expect(
      (await act(contractId("complete"), { action: "cancel", note: null }))
        .status,
    ).toBe(422);
  });

  it("refuses a client and an anonymous caller", async () => {
    expect(
      (
        await act(
          contractId("complete"),
          { action: "cancel", note: null },
          `x-${randomUUID()}`,
          USER,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await act(
          contractId("complete"),
          { action: "cancel", note: null },
          `x-${randomUUID()}`,
          null,
        )
      ).status,
    ).toBe(403);
  });
});
