import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyManagementDecision,
  createBookingRequest,
} from "@/data/booking-requests";
import { registerClient } from "@/data/users";
import { fixtureClock } from "@/domain/fixtures";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const MANAGER = "user-manager-01";
const OTHER_CLIENT = "user-client-silverline";
const OBJECTIVE = `Draft probe ${randomUUID()}`;

let probeUserId = "";
let probeOrganisationId = "";

beforeAll(async () => {
  const registered = await registerClient({
    organisationName: `Probe Co ${randomUUID()}`,
    contactName: "Probe Contact",
    email: `probe-${randomUUID()}@example.test`,
    idempotencyKey: `probe-reg-${randomUUID()}`,
    now: fixtureClock,
  });

  if (registered.status !== "created") throw new Error("probe setup failed");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: registered.userId },
  });

  probeUserId = user.id;
  probeOrganisationId = user.organisationId ?? "";
});

const draft = (
  payload: unknown,
  idempotencyKey?: string,
  userId: string | null = MANAGER,
) =>
  POST(
    new Request("http://localhost/api/management/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-Prototype-User-Id": userId } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    }),
  );

const approvedRequest = async () => {
  const created = await createBookingRequest({
    userId: probeUserId,
    idempotencyKey: `draft-probe-${randomUUID()}`,
    now: fixtureClock,
    productId: "product-bus-rear",
    requestedAssetId: null,
    startDate: "2027-05-01",
    endDate: "2027-06-01",
    budget: 950,
    objective: OBJECTIVE,
    notes: null,
  });

  if (created.status !== "created") throw new Error("probe setup failed");

  await applyManagementDecision({
    requestId: created.request.id,
    action: "approve",
    note: null,
    selectedAssetId: null,
    now: fixtureClock,
  });

  return created.request.id;
};

const body = (bookingRequestId: string) => ({
  organisationId: probeOrganisationId,
  bookingRequestId,
  startDate: "2027-05-01",
  endDate: "2027-06-01",
  items: [
    {
      productId: "product-bus-rear",
      assetId: "asset-bus-101-rear",
      quantity: 1,
      unitRate: 950,
      rateUnit: "month",
      lineTotal: 950,
    },
  ],
  total: 950,
});

afterAll(async () => {
  const made = await prisma.bookingRequest.findMany({
    where: { objective: OBJECTIVE },
    select: { id: true, contracts: { select: { id: true } } },
  });
  const requestIds = made.map((request) => request.id);
  const contractIds = made.flatMap((request) =>
    request.contracts.map((contract) => contract.id),
  );

  await prisma.serviceEvent.deleteMany({
    where: { contractId: { in: contractIds } },
  });
  await prisma.campaign.deleteMany({
    where: { contractId: { in: contractIds } },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: { in: [...contractIds, ...requestIds] } },
  });
  await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.user.deleteMany({ where: { id: probeUserId } });
  await prisma.organisation.deleteMany({ where: { id: probeOrganisationId } });
});

describe("POST /api/management/contracts", () => {
  it("drafts a contract from an approved request", async () => {
    const requestId = await approvedRequest();
    const response = await draft(body(requestId), `draft-${randomUUID()}`);
    const contract = await response.json();

    expect(response.status).toBe(201);
    expect(contract).toMatchObject({
      status: "draft",
      version: 1,
      currency: "GBP",
      total: 950,
      organisationId: probeOrganisationId,
    });
    expect(contract.items).toHaveLength(1);
    expect(contract.issuedAt).toBeNull();
    expect(contract.history.at(-1)).toMatchObject({
      actor: "manager",
      action: "draft_created",
    });
  });

  it("returns the same contract for a repeated idempotency key", async () => {
    const requestId = await approvedRequest();
    const key = `draft-${randomUUID()}`;

    const first = await draft(body(requestId), key);
    const second = await draft(body(requestId), key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).id).toBe((await first.json()).id);
  });

  it("refuses a total that does not match the line totals", async () => {
    const requestId = await approvedRequest();
    const response = await draft(
      { ...body(requestId), total: 5 },
      `draft-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });

  it("refuses a request that management has not approved", async () => {
    const response = await draft(
      { ...body("request-001"), organisationId: "org-silverline" },
      `draft-${randomUUID()}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "REQUEST_STATE_CONFLICT",
    });
  });

  it("refuses a second contract on a request that already has one", async () => {
    const response = await draft(
      {
        organisationId: "org-lighthouse",
        bookingRequestId: "request-002",
        startDate: "2027-02-01",
        endDate: "2027-05-01",
        items: [
          {
            productId: "product-hub-door",
            assetId: "asset-door-b",
            quantity: 1,
            unitRate: 1200,
            rateUnit: "month",
            lineTotal: 3600,
          },
        ],
        total: 3600,
      },
      `draft-${randomUUID()}`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTRACT_STATE_CONFLICT",
    });
  });

  it("refuses an organisation that does not own the request", async () => {
    const requestId = await approvedRequest();
    const response = await draft(
      { ...body(requestId), organisationId: "org-oak-legal" },
      `draft-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });

  it("refuses an asset from another product and a missing key", async () => {
    const requestId = await approvedRequest();

    expect(
      (
        await draft(
          {
            ...body(requestId),
            items: [{ ...body(requestId).items[0], assetId: "asset-van-12" }],
          },
          `draft-${randomUUID()}`,
        )
      ).status,
    ).toBe(422);

    expect((await draft(body(requestId))).status).toBe(422);
  });

  it("refuses a client and an anonymous caller", async () => {
    const requestId = await approvedRequest();

    expect(
      (await draft(body(requestId), `draft-${randomUUID()}`, OTHER_CLIENT))
        .status,
    ).toBe(403);
    expect(
      (await draft(body(requestId), `draft-${randomUUID()}`, null)).status,
    ).toBe(403);
  });
});
