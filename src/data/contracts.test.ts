import { describe, expect, it } from "vitest";
import {
  getContractForOrganisation,
  listContractsForOrganisation,
} from "./contracts";

const LIGHTHOUSE = "org-lighthouse";
const OAK_LEGAL = "org-oak-legal";
const SILVERLINE = "org-silverline";

describe("organisation scoping", () => {
  it("returns a contract to the organisation that owns it", async () => {
    const contract = await getContractForOrganisation(
      LIGHTHOUSE,
      "contract-001",
    );

    expect(contract?.id).toBe("contract-001");
    expect(contract?.organisationId).toBe(LIGHTHOUSE);
  });

  it("does not return one organisation's contract to another", async () => {
    expect(
      await getContractForOrganisation(OAK_LEGAL, "contract-001"),
    ).toBeNull();
    expect(
      await getContractForOrganisation(LIGHTHOUSE, "contract-002"),
    ).toBeNull();
  });

  it("lists only the contracts an organisation owns", async () => {
    const lighthouse = await listContractsForOrganisation(LIGHTHOUSE);
    const oakLegal = await listContractsForOrganisation(OAK_LEGAL);

    expect(lighthouse.map((contract) => contract.id)).toEqual(["contract-001"]);
    expect(oakLegal.map((contract) => contract.id)).toEqual(["contract-002"]);
  });

  it("gives an organisation with no contracts an empty list, not an error", async () => {
    expect(await listContractsForOrganisation(SILVERLINE)).toEqual([]);
  });
});

describe("client-visible fields", () => {
  it("returns money as a number and dates as calendar strings", async () => {
    const contract = await getContractForOrganisation(
      OAK_LEGAL,
      "contract-002",
    );

    expect(contract?.total).toBe(2700);
    expect(contract?.startDate).toBe("2027-01-01");
    expect(contract?.endDate).toBe("2027-07-01");
  });

  it("withholds service events that are not client visible", async () => {
    const contract = await getContractForOrganisation(
      OAK_LEGAL,
      "contract-002",
    );

    expect(contract?.serviceEvents.length).toBeGreaterThan(0);
    expect(contract?.serviceEvents.every((event) => event.clientVisible)).toBe(
      true,
    );
  });
});
