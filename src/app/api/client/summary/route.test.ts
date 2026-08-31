import { describe, expect, it } from "vitest";
import { GET } from "./route";

const summary = (userId: string | null) =>
  GET(
    new Request("http://localhost/api/client/summary", {
      headers: userId ? { "X-Prototype-User-Id": userId } : {},
    }),
  );

describe("GET /api/client/summary", () => {
  it("gives a client with no contracts a usable home rather than an error", async () => {
    const response = await summary("user-client-silverline");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.organisation.name).toBe("Silverline Fitness");
    expect(body.organisation.contractCount).toBe(0);
    expect(body.contracts).toEqual([]);
    expect(body.attentionItems).toEqual([]);
    expect(body.recentServiceEvents).toEqual([]);
  });

  it("raises an issued contract as something the client must act on", async () => {
    const body = await (await summary("user-client-lighthouse")).json();

    expect(body.contracts[0]).toMatchObject({
      id: "contract-001",
      status: "issued",
      actionRequired: "Review and accept or request changes",
    });
    expect(body.attentionItems).toEqual([
      expect.objectContaining({
        type: "contract_awaiting_response",
        contractId: "contract-001",
      }),
    ]);
  });

  it("raises a pending client request without claiming it is resolved", async () => {
    const body = await (await summary("user-client-oaklegal")).json();

    expect(body.contracts[0].actionRequired).toBeNull();
    expect(body.attentionItems).toEqual([
      expect.objectContaining({ type: "request_pending_review" }),
    ]);
  });

  it("shows only client-visible service events", async () => {
    const body = await (await summary("user-client-oaklegal")).json();

    expect(body.recentServiceEvents.length).toBeGreaterThan(0);
    expect(
      body.recentServiceEvents.every(
        (event: { clientVisible: boolean }) => event.clientVisible,
      ),
    ).toBe(true);
  });

  it("refuses a user who is not a client", async () => {
    expect((await summary("user-manager-01")).status).toBe(403);
    expect((await summary(null)).status).toBe(403);
  });
});
