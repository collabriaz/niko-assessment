import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { DELETE } from "./[productId]/route";
import { GET, POST } from "./route";

const SILVERLINE = "user-client-silverline";
const LIGHTHOUSE = "user-client-lighthouse";

const url = "http://localhost/api/client/shortlist";

const list = (userId: string) =>
  GET(new Request(url, { headers: { "X-Prototype-User-Id": userId } }));

const add = (userId: string, payload: unknown) =>
  POST(
    new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Prototype-User-Id": userId,
      },
      body: JSON.stringify(payload),
    }),
  );

const remove = (userId: string, productId: string) =>
  DELETE(
    new Request(`${url}/${productId}`, {
      method: "DELETE",
      headers: { "X-Prototype-User-Id": userId },
    }),
    { params: Promise.resolve({ productId }) },
  );

afterAll(async () => {
  await prisma.shortlistItem.deleteMany({
    where: { organisationId: { in: ["org-silverline", "org-lighthouse"] } },
  });
});

describe("the client shortlist", () => {
  it("persists a product with the dates it was shortlisted for", async () => {
    const response = await add(SILVERLINE, {
      productId: "product-bus-rear",
      startDate: "2027-03-01",
      endDate: "2027-03-05",
    });
    const { items } = await response.json();

    expect(response.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0].product.id).toBe("product-bus-rear");
    expect(items[0].startDate).toBe("2027-03-01");
    expect(items[0].product.availability.state).toBe("available");
    expect(items[0].product.availability.availableAssetCount).toBe(2);
  });

  it("survives being read back in a separate request", async () => {
    const { items } = await (await list(SILVERLINE)).json();

    expect(
      items.map((item: { product: { id: string } }) => item.product.id),
    ).toEqual(["product-bus-rear"]);
  });

  it("updates the dates rather than duplicating the product", async () => {
    const { items } = await (
      await add(SILVERLINE, {
        productId: "product-bus-rear",
        startDate: "2027-02-12",
        endDate: "2027-02-18",
      })
    ).json();

    expect(items).toHaveLength(1);
    expect(items[0].startDate).toBe("2027-02-12");
    expect(items[0].product.availability.state).toBe("unavailable");
  });

  it("keeps one organisation's shortlist out of another's", async () => {
    await add(LIGHTHOUSE, {
      productId: "product-hub-door",
      startDate: "2027-03-01",
      endDate: "2027-06-01",
    });

    const silverline = await (await list(SILVERLINE)).json();
    const lighthouse = await (await list(LIGHTHOUSE)).json();

    expect(
      silverline.items.map(
        (item: { product: { id: string } }) => item.product.id,
      ),
    ).toEqual(["product-bus-rear"]);
    expect(
      lighthouse.items.map(
        (item: { product: { id: string } }) => item.product.id,
      ),
    ).toEqual(["product-hub-door"]);
  });

  it("removes a product and reports a second removal as missing", async () => {
    expect((await remove(SILVERLINE, "product-bus-rear")).status).toBe(204);
    expect((await remove(SILVERLINE, "product-bus-rear")).status).toBe(404);

    const { items } = await (await list(SILVERLINE)).json();
    expect(items).toEqual([]);
  });

  it("rejects an entry whose dates are not a valid range", async () => {
    const response = await add(SILVERLINE, {
      productId: "product-bus-rear",
      startDate: "2027-03-05",
      endDate: "2027-03-01",
    });

    expect(response.status).toBe(422);
  });
});
