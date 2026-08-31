import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const SILVERLINE_CLIENT = "user-client-silverline";
const MANAGER = "user-manager-01";
const OBJECTIVE = `Probe objective ${randomUUID()}`;
const key = () => `probe-key-${randomUUID()}`;

const body = {
  productId: "product-bus-rear",
  startDate: "2027-05-01",
  endDate: "2027-06-01",
  budget: 950,
  objective: OBJECTIVE,
};

const submit = (
  payload: unknown,
  idempotencyKey?: string,
  userId: string | null = SILVERLINE_CLIENT,
) =>
  POST(
    new Request("http://localhost/api/booking-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-Prototype-User-Id": userId } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    }),
  );

afterAll(async () => {
  const made = await prisma.bookingRequest.findMany({
    where: { objective: OBJECTIVE },
    select: { id: true },
  });
  const ids = made.map((request) => request.id);

  await prisma.idempotencyKey.deleteMany({ where: { recordId: { in: ids } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: ids } } });
});

describe("POST /api/booking-requests", () => {
  const sharedKey = key();

  it("creates a submitted request with its first history entry", async () => {
    const response = await submit(body, sharedKey);
    const created = await response.json();

    expect(response.status).toBe(201);
    expect(created.status).toBe("submitted");
    expect(created.organisationId).toBe("org-silverline");
    expect(created.draftContractId).toBeNull();
    expect(created.history).toEqual([
      {
        at: "2027-01-15T09:00:00.000Z",
        actor: "client",
        action: "submitted",
        note: null,
      },
    ]);
  });

  it("returns the existing request for a repeated idempotency key", async () => {
    const first = await (await submit(body, sharedKey)).json();
    const second = await submit(body, sharedKey);
    const repeated = await second.json();

    expect(second.status).toBe(200);
    expect(repeated.id).toBe(first.id);
    expect(
      await prisma.bookingRequest.count({ where: { objective: OBJECTIVE } }),
    ).toBe(1);
  });

  it("creates a second request for a new idempotency key", async () => {
    const response = await submit(body, key());

    expect(response.status).toBe(201);
    expect(
      await prisma.bookingRequest.count({ where: { objective: OBJECTIVE } }),
    ).toBe(2);
  });

  it("rejects a missing idempotency key", async () => {
    expect((await submit(body)).status).toBe(422);
  });

  it("rejects an end date that is not after the start date", async () => {
    const response = await submit(
      { ...body, startDate: "2027-05-01", endDate: "2027-05-01" },
      key(),
    );

    expect(response.status).toBe(422);
  });

  it("rejects an asset that belongs to a different product", async () => {
    const response = await submit(
      { ...body, requestedAssetId: "asset-door-a" },
      key(),
    );

    expect(response.status).toBe(422);
  });

  it("refuses a user who is not a client", async () => {
    expect((await submit(body, key(), MANAGER)).status).toBe(403);
  });

  it("refuses a request with no prototype user", async () => {
    expect((await submit(body, key(), null)).status).toBe(403);
  });
});
