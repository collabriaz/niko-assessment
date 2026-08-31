import { describe, expect, it } from "vitest";
import { GET } from "./route";

const MANAGER = "user-manager-01";
const CLIENT = "user-client-silverline";
const FITTER = "user-fitter-01";

const list = (userId: string | null, status?: string) =>
  GET(
    new Request(
      `http://localhost/api/management/booking-requests${status ? `?status=${status}` : ""}`,
      { headers: userId ? { "X-Prototype-User-Id": userId } : {} },
    ),
  );

describe("GET /api/management/booking-requests", () => {
  it("lists every organisation's requests, not one organisation's", async () => {
    const response = await list(MANAGER);
    const { items } = await response.json();

    expect(response.status).toBe(200);
    expect(items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["request-001", "request-002"]),
    );
    expect(
      new Set(
        items.map((item: { organisationId: string }) => item.organisationId),
      ).size,
    ).toBeGreaterThan(1);
  });

  it("names the client and product rather than returning bare ids", async () => {
    const { items } = await (await list(MANAGER)).json();
    const seeded = items.find(
      (item: { id: string }) => item.id === "request-001",
    );

    expect(seeded).toMatchObject({
      organisationName: "Silverline Fitness",
      productName: "Bus rear panel",
      status: "submitted",
    });
  });

  it("puts what management must act on above what it need not", async () => {
    const { items } = await (await list(MANAGER)).json();
    const waiting = items.findIndex(
      (item: { attentionReason: string | null }) =>
        item.attentionReason === null,
    );
    const raised = items.findIndex(
      (item: { attentionReason: string | null }) =>
        item.attentionReason !== null,
    );

    expect(raised).toBeLessThan(waiting === -1 ? items.length : waiting);
  });

  it("discloses the short term on the seeded request without blocking it", async () => {
    const { items } = await (await list(MANAGER)).json();
    const seeded = items.find(
      (item: { id: string }) => item.id === "request-001",
    );

    expect(seeded.attentionReason).toBe(
      "Awaiting decision. 6 of 30 day minimum term.",
    );
  });

  it("filters to one status", async () => {
    const { items } = await (await list(MANAGER, "approved")).json();

    expect(items).not.toHaveLength(0);
    for (const item of items) expect(item.status).toBe("approved");
  });

  it("rejects a status that does not exist", async () => {
    expect((await list(MANAGER, "banana")).status).toBe(422);
  });

  it("refuses a client, a fitter and an anonymous caller", async () => {
    for (const userId of [CLIENT, FITTER, null])
      expect((await list(userId)).status).toBe(403);
  });
});
