import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as shortlist } from "@/app/api/client/shortlist/route";
import { GET as clientSummary } from "@/app/api/client/summary/route";
import { GET as managementInbox } from "@/app/api/management/booking-requests/route";
import { registerClient } from "@/data/users";
import { fixtureClock } from "@/domain/fixtures";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const SILVERLINE_CLIENT = "user-client-silverline";
const MANAGER = "user-manager-01";
const OBJECTIVE = `Probe objective ${randomUUID()}`;
const key = () => `probe-key-${randomUUID()}`;

const JOURNEY_PRODUCT = "product-hub-screen";
const JOURNEY_START = "2027-04-01";
const JOURNEY_END = "2027-04-15";

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

let journeyUserId = "";
let journeyOrganisationId = "";
let journeyOrganisationName = "";

beforeAll(async () => {
  journeyOrganisationName = `Journey Co ${randomUUID()}`;

  const registered = await registerClient({
    organisationName: journeyOrganisationName,
    contactName: "Journey Contact",
    email: `journey-${randomUUID()}@example.test`,
    idempotencyKey: `journey-reg-${randomUUID()}`,
    now: fixtureClock,
  });

  if (registered.status !== "created") throw new Error("probe setup failed");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: registered.userId },
  });

  journeyUserId = user.id;
  journeyOrganisationId = user.organisationId ?? "";
});

afterAll(async () => {
  const made = await prisma.bookingRequest.findMany({
    where: { objective: OBJECTIVE },
    select: { id: true },
  });
  const ids = made.map((request) => request.id);

  await prisma.idempotencyKey.deleteMany({ where: { recordId: { in: ids } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: ids } } });
  await prisma.shortlistItem.deleteMany({
    where: { organisationId: journeyOrganisationId },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { recordId: journeyUserId },
  });
  await prisma.user.deleteMany({ where: { id: journeyUserId } });
  await prisma.organisation.deleteMany({
    where: { id: journeyOrganisationId },
  });
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

describe("the journey a new client takes from the catalogue to management", () => {
  it("carries a shortlisted product and its dates into the management inbox", async () => {
    const saved = await shortlist(
      new Request("http://localhost/api/client/shortlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Prototype-User-Id": journeyUserId,
        },
        body: JSON.stringify({
          productId: JOURNEY_PRODUCT,
          startDate: JOURNEY_START,
          endDate: JOURNEY_END,
        }),
      }),
    );

    expect(saved.status).toBe(200);

    const shortlisted = (await saved.json()).items.find(
      (item: { product: { id: string } }) =>
        item.product.id === JOURNEY_PRODUCT,
    );

    expect(shortlisted).toMatchObject({
      startDate: JOURNEY_START,
      endDate: JOURNEY_END,
    });
    expect(shortlisted.product.availability.state).toBe("available");

    const submitted = await submit(
      {
        productId: shortlisted.product.id,
        startDate: shortlisted.startDate,
        endDate: shortlisted.endDate,
        budget: 1400,
        objective: OBJECTIVE,
      },
      key(),
      journeyUserId,
    );
    const request = await submitted.json();

    expect(submitted.status).toBe(201);
    expect(request.status).toBe("submitted");

    const { items } = await (
      await managementInbox(
        new Request("http://localhost/api/management/booking-requests", {
          headers: { "X-Prototype-User-Id": MANAGER },
        }),
      )
    ).json();

    expect(
      items.find((item: { id: string }) => item.id === request.id),
    ).toMatchObject({
      organisationName: journeyOrganisationName,
      productName: "Hub portrait screen network",
      status: "submitted",
    });

    const summary = await (
      await clientSummary(
        new Request("http://localhost/api/client/summary", {
          headers: { "X-Prototype-User-Id": journeyUserId },
        }),
      )
    ).json();

    expect(
      summary.bookingRequests.find(
        (item: { id: string }) => item.id === request.id,
      ),
    ).toMatchObject({
      productName: "Hub portrait screen network",
      startDate: JOURNEY_START,
      endDate: JOURNEY_END,
      status: "submitted",
    });
    expect(summary.contracts).toEqual([]);
  });
});
