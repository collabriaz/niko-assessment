import { describe, expect, it } from "vitest";
import {
  acceptedContractStatus,
  clientActionAllowed,
  clientActionRequired,
} from "./contracts";
import { fixtureClock } from "./fixtures";

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
