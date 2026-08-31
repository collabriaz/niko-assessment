import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createBookingRequest } from "@/data/booking-requests";
import { fixtureClock } from "@/domain/fixtures";
import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "./route";

const MANAGER = "user-manager-01";
const CLIENT = "user-client-silverline";
const OBJECTIVE = `Decision probe ${randomUUID()}`;

const get = (userId: string | null, requestId: string) =>
  GET(
    new Request(
      `http://localhost/api/management/booking-requests/${requestId}`,
      { headers: userId ? { "X-Prototype-User-Id": userId } : {} },
    ),
    { params: Promise.resolve({ requestId }) },
  );

const decide = (
  userId: string | null,
  requestId: string,
  body: Record<string, unknown>,
) =>
  PATCH(
    new Request(
      `http://localhost/api/management/booking-requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "X-Prototype-User-Id": userId } : {}),
        },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ requestId }) },
  );

const openRequest = async () => {
  const result = await createBookingRequest({
    userId: CLIENT,
    idempotencyKey: `decision-probe-${randomUUID()}`,
    now: fixtureClock,
    productId: "product-bus-rear",
    requestedAssetId: null,
    startDate: "2027-05-01",
    endDate: "2027-06-01",
    budget: 950,
    objective: OBJECTIVE,
    notes: null,
  });

  if (result.status !== "created") throw new Error("probe setup failed");

  return result.request.id;
};

afterAll(async () => {
  const made = await prisma.bookingRequest.findMany({
    where: { objective: OBJECTIVE },
    select: { id: true },
  });
  const ids = made.map((request) => request.id);

  await prisma.idempotencyKey.deleteMany({ where: { recordId: { in: ids } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: ids } } });
});

describe("GET /api/management/booking-requests/[requestId]", () => {
  it("returns the client, the product and current availability together", async () => {
    const response = await get(MANAGER, "request-001");
    const detail = await response.json();

    expect(response.status).toBe(200);
    expect(detail.organisation).toMatchObject({
      id: "org-silverline",
      name: "Silverline Fitness",
    });
    expect(detail.organisation.contractCount).toBe(0);
    expect(detail.product).toMatchObject({ id: "product-bus-rear" });
    expect(detail.currentAvailability.state).toBe("unavailable");
  });

  it("reads availability now rather than replaying what the client saw", async () => {
    const { currentAvailability } = await (
      await get(MANAGER, "request-001")
    ).json();

    expect(currentAvailability.calculatedAt).toBe(fixtureClock.toISOString());
    expect(currentAvailability.availableAssetCount).toBe(0);
  });

  it("returns 404 for a request that does not exist", async () => {
    expect((await get(MANAGER, "request-nope")).status).toBe(404);
  });

  it("refuses a client and an anonymous caller", async () => {
    expect((await get(CLIENT, "request-001")).status).toBe(403);
    expect((await get(null, "request-001")).status).toBe(403);
  });
});

describe("approval rechecks inventory", () => {
  it("refuses the seeded request whose assets are all taken", async () => {
    const response = await decide(MANAGER, "request-001", {
      action: "approve",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVENTORY_CONFLICT",
    });
  });

  it("leaves the refused request open rather than half-decided", async () => {
    const { status, history } = await (
      await get(MANAGER, "request-001")
    ).json();

    expect(status).toBe("submitted");
    expect(history).toHaveLength(1);
  });

  it("approves a request whose dates are free", async () => {
    const requestId = await openRequest();
    const response = await decide(MANAGER, requestId, { action: "approve" });
    const decided = await response.json();

    expect(response.status).toBe(200);
    expect(decided.status).toBe("approved");
    expect(decided.history.at(-1)).toEqual({
      at: fixtureClock.toISOString(),
      actor: "manager",
      action: "approve",
      note: null,
    });
  });

  it("refuses to decide the same request twice", async () => {
    const requestId = await openRequest();

    await decide(MANAGER, requestId, { action: "approve" });
    const second = await decide(MANAGER, requestId, {
      action: "decline",
      note: "Trying to reverse an approval.",
    });

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      code: "REQUEST_STATE_CONFLICT",
    });
  });

  it("refuses to re-decide the seeded approved request", async () => {
    const response = await decide(MANAGER, "request-002", {
      action: "decline",
      note: "Changed our mind.",
    });

    expect(response.status).toBe(409);
  });
});

describe("what a decision must supply", () => {
  it("declines only with a reason on the record", async () => {
    const requestId = await openRequest();

    expect(
      (await decide(MANAGER, requestId, { action: "decline" })).status,
    ).toBe(422);

    const withReason = await decide(MANAGER, requestId, {
      action: "decline",
      note: "No inventory on the islandwide route.",
    });

    expect(withReason.status).toBe(200);
    await expect(withReason.json()).resolves.toMatchObject({
      status: "declined",
    });
  });

  it("asks for information only with a question on the record", async () => {
    const requestId = await openRequest();

    expect(
      (await decide(MANAGER, requestId, { action: "request_information" }))
        .status,
    ).toBe(422);

    const asked = await decide(MANAGER, requestId, {
      action: "request_information",
      note: "When will the artwork be ready?",
    });

    expect(asked.status).toBe(200);
    await expect(asked.json()).resolves.toMatchObject({
      status: "information_required",
    });
  });

  it("still accepts a decision on a request waiting for the client", async () => {
    const requestId = await openRequest();

    await decide(MANAGER, requestId, {
      action: "request_information",
      note: "When will the artwork be ready?",
    });
    const approved = await decide(MANAGER, requestId, { action: "approve" });

    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("rejects an unknown action and an asset from another product", async () => {
    const requestId = await openRequest();

    expect(
      (await decide(MANAGER, requestId, { action: "shelve" })).status,
    ).toBe(422);
    expect(
      (
        await decide(MANAGER, requestId, {
          action: "approve",
          selectedAssetId: "asset-van-12",
        })
      ).status,
    ).toBe(422);
  });

  it("records the allocated asset on the history entry", async () => {
    const requestId = await openRequest();
    const response = await decide(MANAGER, requestId, {
      action: "approve",
      selectedAssetId: "asset-bus-101-rear",
    });
    const decided = await response.json();

    expect(response.status).toBe(200);
    expect(decided.history.at(-1).note).toContain("asset-bus-101-rear");
    expect(decided.requestedAssetId).toBeNull();
  });

  it("refuses a client trying to decide their own request", async () => {
    expect(
      (await decide(CLIENT, "request-001", { action: "approve" })).status,
    ).toBe(403);
  });
});
