import { describe, expect, it } from "vitest";
import {
  attentionReason,
  decidedStatus,
  decisionAllowed,
  decisionNeedsNote,
  shortTermWarning,
} from "./booking-requests";
import { fixtures } from "./fixtures";

const request = (id: string) => {
  const found = fixtures.bookingRequests.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown request ${id}`);

  return found;
};

const minimumTermDays = (productId: string) => {
  const product = fixtures.products.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product ${productId}`);

  return product.minimumTermDays;
};

describe("which requests management can still decide", () => {
  it("accepts a decision while the request is open", () => {
    expect(decisionAllowed("submitted")).toBe(true);
    expect(decisionAllowed("information_required")).toBe(true);
  });

  it("refuses a second decision on a request already settled", () => {
    expect(decisionAllowed("approved")).toBe(false);
    expect(decisionAllowed("declined")).toBe(false);
  });

  it("refuses to re-decide the seeded approved request", () => {
    expect(decisionAllowed(request("request-002").status)).toBe(false);
  });

  it("maps each decision to the status it leaves behind", () => {
    expect(decidedStatus.request_information).toBe("information_required");
    expect(decidedStatus.approve).toBe("approved");
    expect(decidedStatus.decline).toBe("declined");
  });

  it("requires a note for every decision the client must act on", () => {
    expect(decisionNeedsNote("request_information")).toBe(true);
    expect(decisionNeedsNote("decline")).toBe(true);
    expect(decisionNeedsNote("approve")).toBe(false);
  });
});

describe("minimum term is disclosed, never enforced", () => {
  it("flags the seeded request that is one day short", () => {
    const seeded = request("request-002");

    expect(
      shortTermWarning(
        seeded.startDate,
        seeded.endDate,
        minimumTermDays(seeded.productId),
      ),
    ).toBe("89 of 90 day minimum term");
  });

  it("stays silent on a term that exactly meets the minimum", () => {
    expect(shortTermWarning("2027-02-01", "2027-05-02", 90)).toBeNull();
  });

  it("flags a term one day under the minimum", () => {
    expect(shortTermWarning("2027-02-01", "2027-05-01", 90)).toBe(
      "89 of 90 day minimum term",
    );
  });

  it("still allows a short request to be decided", () => {
    expect(decisionAllowed(request("request-001").status)).toBe(true);
  });
});

describe("what management is asked to look at first", () => {
  it("raises the seeded request with its short term", () => {
    const seeded = request("request-001");

    expect(
      attentionReason({
        status: seeded.status,
        startDate: seeded.startDate,
        endDate: seeded.endDate,
        minimumTermDays: minimumTermDays(seeded.productId),
        draftContractId: null,
      }),
    ).toBe("Awaiting decision. 6 of 30 day minimum term.");
  });

  it("asks for a contract once a request is approved without one", () => {
    expect(
      attentionReason({
        status: "approved",
        startDate: "2027-02-01",
        endDate: "2027-05-01",
        minimumTermDays: 90,
        draftContractId: null,
      }),
    ).toBe("Approved. Needs a draft contract.");
  });

  it("stops asking once the approved request has its draft", () => {
    expect(
      attentionReason({
        status: "approved",
        startDate: "2027-02-01",
        endDate: "2027-05-01",
        minimumTermDays: 90,
        draftContractId: "contract-001",
      }),
    ).toBeNull();
  });

  it("shows a request waiting on the client as waiting on the client", () => {
    expect(
      attentionReason({
        status: "information_required",
        startDate: "2027-02-12",
        endDate: "2027-02-18",
        minimumTermDays: 30,
        draftContractId: null,
      }),
    ).toBe("Waiting on the client to reply.");
  });

  it("raises nothing for a declined request", () => {
    expect(
      attentionReason({
        status: "declined",
        startDate: "2027-02-12",
        endDate: "2027-02-18",
        minimumTermDays: 30,
        draftContractId: null,
      }),
    ).toBeNull();
  });
});
