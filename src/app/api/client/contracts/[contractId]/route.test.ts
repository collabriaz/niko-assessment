import { describe, expect, it } from "vitest";
import { GET } from "./route";

const LIGHTHOUSE_CLIENT = "user-client-lighthouse";
const OAK_LEGAL_CLIENT = "user-client-oaklegal";
const MANAGER = "user-manager-01";

const get = (userId: string | null, contractId: string) =>
  GET(
    new Request(`http://localhost/api/client/contracts/${contractId}`, {
      headers: userId ? { "X-Prototype-User-Id": userId } : {},
    }),
    { params: Promise.resolve({ contractId }) },
  );

describe("GET /api/client/contracts/[contractId]", () => {
  it("returns the contract to the organisation that owns it", async () => {
    const response = await get(LIGHTHOUSE_CLIENT, "contract-001");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "contract-001",
      status: "issued",
    });
  });

  it("does not expose another organisation's contract", async () => {
    const response = await get(OAK_LEGAL_CLIENT, "contract-001");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reports a real and a missing contract identically to an outsider", async () => {
    const real = await get(OAK_LEGAL_CLIENT, "contract-001");
    const imaginary = await get(OAK_LEGAL_CLIENT, "contract-does-not-exist");

    expect(await real.json()).toEqual(await imaginary.json());
    expect(real.status).toBe(imaginary.status);
  });

  it("refuses a user whose role is not client", async () => {
    const response = await get(MANAGER, "contract-001");

    expect(response.status).toBe(403);
  });

  it("refuses a request with no prototype user", async () => {
    const response = await get(null, "contract-001");

    expect(response.status).toBe(403);
  });
});
