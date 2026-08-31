import { describe, expect, it } from "vitest";
import { GET } from "./route";

const MANAGER = "user-manager-01";
const CLIENT = "user-client-silverline";
const FITTER = "user-fitter-01";

const load = (userId: string | null) =>
  GET(
    new Request("http://localhost/api/management/dashboard", {
      headers: userId ? { "X-Prototype-User-Id": userId } : {},
    }),
  );

describe("GET /api/management/dashboard", () => {
  it("raises the request waiting for a decision", async () => {
    const response = await load(MANAGER);
    const { attentionItems } = await response.json();

    expect(response.status).toBe(200);
    expect(
      attentionItems.find((item: { id: string }) => item.id === "request-001"),
    ).toMatchObject({
      kind: "booking_request",
      href: "/manage/requests/request-001",
    });
  });

  it("raises the client's pending change request", async () => {
    const { attentionItems } = await (await load(MANAGER)).json();
    const raised = attentionItems.find(
      (item: { id: string }) => item.id === "client-request-001",
    );

    expect(raised).toMatchObject({ kind: "client_request" });
    expect(raised.detail).toContain("installation can start after 09:00");
  });

  it("counts what is waiting on management and what is waiting on the client", async () => {
    const { counts } = await (await load(MANAGER)).json();

    expect(counts.requestsAwaitingDecision).toBeGreaterThanOrEqual(1);
    expect(counts.clientRequestsPending).toBeGreaterThanOrEqual(1);
    expect(counts.contractsAwaitingClient).toBeGreaterThanOrEqual(1);
  });

  it("lists the job scheduled for the day after the fixture clock", async () => {
    const { upcomingWorkOrders } = await (await load(MANAGER)).json();
    const seeded = upcomingWorkOrders.find(
      (workOrder: { id: string }) => workOrder.id === "work-order-001",
    );

    expect(seeded).toMatchObject({
      status: "assigned",
      assignedUserId: FITTER,
      scheduledStart: "2027-01-16T08:30:00.000Z",
    });
  });

  it("puts the soonest job first", async () => {
    const { upcomingWorkOrders } = await (await load(MANAGER)).json();
    const starts = upcomingWorkOrders.map(
      (workOrder: { scheduledStart: string }) => workOrder.scheduledStart,
    );

    expect(starts).toEqual([...starts].sort());
  });

  it("never puts a fitter's internal notes on the dashboard", async () => {
    const response = await load(MANAGER);
    const body = await response.text();

    expect(body).not.toContain("internalNotes");
    expect(body).not.toContain("Depot contact details");
  });

  it("refuses a client, a fitter and an anonymous caller", async () => {
    for (const userId of [CLIENT, FITTER, null])
      expect((await load(userId)).status).toBe(403);
  });
});
