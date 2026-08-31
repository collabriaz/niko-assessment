import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { GET as getClientContracts } from "@/app/api/client/contracts/route";
import { GET as getProducts } from "@/app/api/products/route";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const email = `probe-${randomUUID()}@example.test`;
const idempotencyKey = `probe-key-${randomUUID()}`;
const created: { userId?: string; organisationId?: string } = {};

const register = (body: unknown, key?: string) =>
  POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const details = {
  organisationName: "Probe Industries",
  contactName: "Probe Tester",
  email,
};

afterAll(async () => {
  if (created.userId) {
    await prisma.idempotencyKey.deleteMany({
      where: { recordId: created.userId },
    });
    await prisma.user.deleteMany({ where: { id: created.userId } });
  }
  if (created.organisationId)
    await prisma.organisation.deleteMany({
      where: { id: created.organisationId },
    });
});

describe("POST /api/auth/register", () => {
  it("creates a client user and organisation with no contracts", async () => {
    const response = await register(details, idempotencyKey);
    const session = await response.json();

    created.userId = session.user.id;
    created.organisationId = session.organisation.id;

    expect(response.status).toBe(201);
    expect(session.user.role).toBe("client");
    expect(session.organisation.name).toBe("Probe Industries");
    expect(session.organisation.contractCount).toBe(0);
  });

  it("returns the same account for a repeated idempotency key", async () => {
    const response = await register(details, idempotencyKey);
    const session = await response.json();

    expect(response.status).toBe(200);
    expect(session.user.id).toBe(created.userId);
    expect(
      await prisma.organisation.count({ where: { name: "Probe Industries" } }),
    ).toBe(1);
  });

  it("rejects a missing idempotency key", async () => {
    const response = await register(details);

    expect(response.status).toBe(422);
  });

  it("rejects an idempotency key shorter than the contract allows", async () => {
    const response = await register(details, "short");

    expect(response.status).toBe(422);
  });

  it("rejects an email that is already registered", async () => {
    const response = await register(
      { ...details, email: "avery@example.test" },
      `probe-key-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });

  it("rejects details that fail validation", async () => {
    const response = await register(
      { organisationName: "X", contactName: "Y", email: "not-an-email" },
      `probe-key-${randomUUID()}`,
    );

    expect(response.status).toBe(422);
  });
});

describe("a client with no contracts", () => {
  it("sees an empty contract list rather than an error", async () => {
    const response = await getClientContracts(
      new Request("http://localhost/api/client/contracts", {
        headers: { "X-Prototype-User-Id": created.userId ?? "" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  it("can still browse the full catalogue", async () => {
    const response = await getProducts(
      new Request(
        "http://localhost/api/products?startDate=2027-04-01&endDate=2027-04-15",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.length).toBe(6);
  });
});
