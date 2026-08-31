import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as clientAction } from "@/app/api/client/contracts/[contractId]/actions/route";
import { POST as draftContract } from "@/app/api/management/contracts/route";
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
const OBJECTIVE = `Issue probe ${randomUUID()}`;

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

const issue = (
  contractId: string,
  idempotencyKey?: string,
  userId: string | null = MANAGER,
) =>
  POST(
    new Request(
      `http://localhost/api/management/contracts/${contractId}/issue`,
      {
        method: "POST",
        headers: {
          ...(userId ? { "X-Prototype-User-Id": userId } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
      },
    ),
    { params: Promise.resolve({ contractId }) },
  );

const draftedContract = async () => {
  const created = await createBookingRequest({
    userId: probeUserId,
    idempotencyKey: `issue-probe-${randomUUID()}`,
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

  const response = await draftContract(
    new Request("http://localhost/api/management/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Prototype-User-Id": MANAGER,
        "Idempotency-Key": `issue-draft-${randomUUID()}`,
      },
      body: JSON.stringify({
        organisationId: probeOrganisationId,
        bookingRequestId: created.request.id,
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
      }),
    }),
  );

  return (await response.json()).id as string;
};

afterAll(async () => {
  const made = await prisma.bookingRequest.findMany({
    where: { objective: OBJECTIVE },
    select: { id: true, contracts: { select: { id: true } } },
  });
  const requestIds = made.map((request) => request.id);
  const contractIds = made.flatMap((request) =>
    request.contracts.map((contract) => contract.id),
  );
  const campaigns = await prisma.campaign.findMany({
    where: { contractId: { in: contractIds } },
    select: { bookingId: true },
  });
  const bookingIds = campaigns
    .map((campaign) => campaign.bookingId)
    .filter((id) => id !== null);

  await prisma.serviceEvent.deleteMany({
    where: { contractId: { in: contractIds } },
  });
  await prisma.campaign.deleteMany({
    where: { contractId: { in: contractIds } },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: { in: [...contractIds, ...requestIds] } },
  });
  await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.user.deleteMany({ where: { id: probeUserId } });
  await prisma.organisation.deleteMany({ where: { id: probeOrganisationId } });
});

describe("POST /api/management/contracts/[contractId]/issue", () => {
  it("issues a draft to its client", async () => {
    const contractId = await draftedContract();
    const response = await issue(contractId, `issue-${randomUUID()}`);
    const contract = await response.json();

    expect(response.status).toBe(200);
    expect(contract.status).toBe("issued");
    expect(contract.issuedAt).toBe(fixtureClock.toISOString());
    expect(contract.history.at(-1)).toMatchObject({
      actor: "manager",
      action: "issued",
    });
  });

  it("creates the campaign the contract is connected to", async () => {
    const contractId = await draftedContract();
    const { campaign } = await (
      await issue(contractId, `issue-${randomUUID()}`)
    ).json();

    expect(campaign).toMatchObject({
      status: "awaiting_contract_acceptance",
      currentStage: "contract_issued",
    });
  });

  it("tells the client the contract is ready without leaking anything else", async () => {
    const contractId = await draftedContract();

    await issue(contractId, `issue-${randomUUID()}`);

    const events = await prisma.serviceEvent.findMany({
      where: { contractId },
    });

    expect(events).toHaveLength(1);
    expect(events.at(0)).toMatchObject({
      type: "contract_issued",
      clientVisible: true,
      clientSummary: "Your contract is ready to review.",
    });
  });

  it("issues once for a repeated idempotency key", async () => {
    const contractId = await draftedContract();
    const key = `issue-${randomUUID()}`;

    await issue(contractId, key);
    const second = await issue(contractId, key);

    expect(second.status).toBe(200);
    expect(await prisma.serviceEvent.count({ where: { contractId } })).toBe(1);
  });

  it("refuses to issue the seeded contract that is already issued", async () => {
    const response = await issue("contract-001", `issue-${randomUUID()}`);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONTRACT_STATE_CONFLICT",
    });
  });

  it("refuses an unknown contract, a client and a missing key", async () => {
    expect((await issue("contract-nope", `issue-${randomUUID()}`)).status).toBe(
      404,
    );
    expect(
      (await issue("contract-001", `issue-${randomUUID()}`, OTHER_CLIENT))
        .status,
    ).toBe(403);
    expect((await issue("contract-001")).status).toBe(422);
  });
});

describe("the contract management issued reaches the client and activates", () => {
  it("activates the campaign and books the inventory on acceptance", async () => {
    const contractId = await draftedContract();

    await issue(contractId, `issue-${randomUUID()}`);

    const accepted = await clientAction(
      new Request(
        `http://localhost/api/client/contracts/${contractId}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Prototype-User-Id": probeUserId,
            "Idempotency-Key": `accept-${randomUUID()}`,
          },
          body: JSON.stringify({ action: "accept", note: null }),
        },
      ),
      { params: Promise.resolve({ contractId }) },
    );

    expect(accepted.status).toBe(200);
    expect((await accepted.json()).status).toBe("accepted");

    const campaign = await prisma.campaign.findFirst({ where: { contractId } });

    expect(campaign?.status).toBe("scheduled");
    expect(campaign?.currentStage).toBe("contract_accepted");
    expect(campaign?.bookingId).not.toBeNull();
  });
});
