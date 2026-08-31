import { describe, expect, it } from "vitest";
import {
  acceptedContractStatus,
  clientActionAllowed,
  clientActionRequired,
  contractIssuable,
  contractTotal,
} from "./contracts";
import { fixtureClock, fixtures } from "./fixtures";

describe("what the client may do", () => {
  it("only offers accept and request changes on an issued contract", () => {
    expect(clientActionAllowed("issued", "accept")).toBe(true);
    expect(clientActionAllowed("issued", "request_changes")).toBe(true);
    expect(clientActionAllowed("accepted", "accept")).toBe(false);
    expect(clientActionAllowed("change_requested", "accept")).toBe(false);
    expect(clientActionAllowed("cancelled", "request_changes")).toBe(false);
  });

  it("allows a cancellation request on any live contract but not a closed one", () => {
    for (const status of ["issued", "change_requested", "accepted", "active"])
      expect(clientActionAllowed(status, "request_cancellation")).toBe(true);

    for (const status of ["completed", "cancelled", "draft"])
      expect(clientActionAllowed(status, "request_cancellation")).toBe(false);
  });

  it("raises an action only while a contract is awaiting a response", () => {
    expect(clientActionRequired("issued")).toBe(
      "Review and accept or request changes",
    );
    expect(clientActionRequired("change_requested")).toBeNull();
    expect(clientActionRequired("active")).toBeNull();
  });
});

describe("what acceptance leaves the contract as", () => {
  it("stays accepted while the start date is still ahead", () => {
    expect(acceptedContractStatus("2027-02-01", fixtureClock)).toBe("accepted");
  });

  it("activates when the contract has already started", () => {
    expect(acceptedContractStatus("2027-01-01", fixtureClock)).toBe("active");
    expect(acceptedContractStatus("2027-01-15", fixtureClock)).toBe("active");
  });
});

describe("contract money", () => {
  it("reconciles the total of every seeded contract", () => {
    for (const contract of fixtures.contracts)
      expect(contractTotal(contract.items.map((item) => item.lineTotal))).toBe(
        contract.total,
      );
  });

  it("does not derive a line total from the unit rate", () => {
    const seeded = fixtures.contracts.find((c) => c.id === "contract-001");
    const item = seeded?.items.at(0);

    expect(item?.unitRate).toBe(1200);
    expect(item?.quantity).toBe(1);
    expect(item?.lineTotal).toBe(3600);
  });

  it("adds pence without floating-point drift", () => {
    expect(contractTotal([0.1, 0.2])).toBe(0.3);
    expect(contractTotal([])).toBe(0);
  });
});

describe("which contracts can be issued", () => {
  it("issues a draft and nothing else", () => {
    expect(contractIssuable("draft")).toBe(true);
    for (const status of ["issued", "accepted", "active", "cancelled"])
      expect(contractIssuable(status)).toBe(false);
  });
});
