import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";
import {
  isClientVisibleStatus,
  statusBlockers,
  transitionAllowed,
  WORK_ORDER_STATUSES,
} from "./work-orders";

describe("how a job moves", () => {
  it("covers every status the brief lists", () => {
    expect(WORK_ORDER_STATUSES).toEqual([
      "draft",
      "assigned",
      "travelling",
      "on_site",
      "blocked",
      "completed",
    ]);
  });

  it("walks the seeded job through to completion", () => {
    const seeded = fixtures.workOrders.find((w) => w.id === "work-order-001");

    expect(seeded?.status).toBe("assigned");
    expect(transitionAllowed("assigned", "travelling")).toBe(true);
    expect(transitionAllowed("travelling", "on_site")).toBe(true);
    expect(transitionAllowed("on_site", "completed")).toBe(true);
  });

  it("lets a blocked job recover or finish", () => {
    expect(transitionAllowed("blocked", "on_site")).toBe(true);
    expect(transitionAllowed("blocked", "travelling")).toBe(true);
    expect(transitionAllowed("blocked", "completed")).toBe(true);
  });

  it("refuses to complete a job nobody has reached yet", () => {
    expect(transitionAllowed("assigned", "completed")).toBe(false);
    expect(transitionAllowed("travelling", "completed")).toBe(false);
  });

  it("refuses to move a job backwards or out of completion", () => {
    expect(transitionAllowed("on_site", "assigned")).toBe(false);
    expect(transitionAllowed("completed", "on_site")).toBe(false);
    expect(transitionAllowed("completed", "completed")).toBe(false);
  });
});

describe("what a blocked job needs", () => {
  it("refuses to block without a reason", () => {
    expect(statusBlockers("blocked", null, 0)).toEqual(["a reason"]);
    expect(statusBlockers("blocked", "   ", 0)).toEqual(["a reason"]);
  });

  it("blocks once a reason is given", () => {
    expect(statusBlockers("blocked", "Depot gate locked.", 0)).toEqual([]);
  });
});

describe("what a completed job needs", () => {
  it("refuses completion with neither a note nor proof", () => {
    expect(statusBlockers("completed", null, 0)).toEqual([
      "a completion note",
      "at least one proof attachment",
    ]);
  });

  it("refuses completion with a note but no proof", () => {
    expect(statusBlockers("completed", "Panel fitted.", 0)).toEqual([
      "at least one proof attachment",
    ]);
  });

  it("refuses completion with proof but no note", () => {
    expect(statusBlockers("completed", null, 1)).toEqual(["a completion note"]);
  });

  it("completes with both", () => {
    expect(statusBlockers("completed", "Panel fitted.", 1)).toEqual([]);
  });

  it("asks nothing extra of the states in between", () => {
    for (const status of ["assigned", "travelling", "on_site"] as const)
      expect(statusBlockers(status, null, 0)).toEqual([]);
  });
});

describe("what the client is told", () => {
  it("shows completion and keeps the rest internal", () => {
    expect(isClientVisibleStatus("completed")).toBe(true);
    for (const status of [
      "assigned",
      "travelling",
      "on_site",
      "blocked",
    ] as const)
      expect(isClientVisibleStatus(status)).toBe(false);
  });
});
