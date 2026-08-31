import { describe, expect, it } from "vitest";
import { fixtureClock } from "../domain/fixtures";
import { getProduct, listProducts } from "./products";

const query = (startDate: string, endDate: string) => ({
  startDate,
  endDate,
  now: fixtureClock,
});

describe("catalogue search", () => {
  it("calculates availability from the database, not the fixture file", async () => {
    const items = await listProducts(query("2027-03-01", "2027-03-05"));
    const busRear = items.find((item) => item.id === "product-bus-rear");

    expect(busRear?.availability.state).toBe("available");
    expect(busRear?.availability.availableAssetCount).toBe(2);
  });

  it("counts pool capacity and drops the expired hold", async () => {
    const items = await listProducts(query("2027-02-01", "2027-02-20"));
    const hubScreen = items.find((item) => item.id === "product-hub-screen");

    expect(hubScreen?.availability.state).toBe("available");
    expect(hubScreen?.availability.availableCapacity).toBe(1);
    expect(hubScreen?.availability.totalCapacity).toBe(4);
  });

  it("keeps a price-on-request product out of every budget filter", async () => {
    const all = await listProducts(query("2027-04-01", "2027-04-15"));
    const budgeted = await listProducts({
      ...query("2027-04-01", "2027-04-15"),
      maxMonthlyBudget: 100_000,
    });

    expect(all.map((item) => item.id)).toContain("product-ev-screen");
    expect(budgeted.map((item) => item.id)).not.toContain("product-ev-screen");
  });

  it("shows the native rate label rather than the monthly equivalent", async () => {
    const items = await listProducts(query("2027-04-01", "2027-04-15"));
    const hubScreen = items.find((item) => item.id === "product-hub-screen");

    expect(hubScreen?.indicativeRate.label).toBe("From £600 per 2 weeks");
    expect(hubScreen?.indicativeRate.monthlyEquivalent).toBe(1300);
  });

  it("filters by media type and location", async () => {
    const digital = await listProducts({
      ...query("2027-04-01", "2027-04-15"),
      mediaType: "digital_screen",
    });
    const west = await listProducts({
      ...query("2027-04-01", "2027-04-15"),
      locationId: "loc-west",
    });

    expect(digital.map((item) => item.id).sort()).toEqual([
      "product-ev-screen",
      "product-hub-screen",
    ]);
    expect(west.map((item) => item.id).sort()).toEqual([
      "product-ev-screen",
      "product-van-rear",
    ]);
  });
});

describe("product detail", () => {
  it("returns an availability summary for each named asset", async () => {
    const product = await getProduct(
      "product-bus-rear",
      query("2027-03-06", "2027-03-10"),
    );
    const states = Object.fromEntries(
      product?.assetOptions.map((asset) => [
        asset.id,
        asset.availability.state,
      ]) ?? [],
    );

    expect(states["asset-bus-101-rear"]).toBe("available");
    expect(states["asset-bus-103-rear"]).toBe("unavailable");
  });

  it("renders a price-on-request product without inventing a price", async () => {
    const product = await getProduct(
      "product-ev-screen",
      query("2027-04-01", "2027-04-15"),
    );

    expect(product?.indicativeRate.amount).toBeNull();
    expect(product?.indicativeRate.monthlyEquivalent).toBeNull();
    expect(product?.indicativeRate.label).toBe("Price on request");
  });

  it("returns no asset options for a capacity-pool product", async () => {
    const product = await getProduct(
      "product-hub-screen",
      query("2027-04-01", "2027-04-15"),
    );

    expect(product?.assetOptions).toEqual([]);
  });

  it("returns null for an unknown product", async () => {
    expect(
      await getProduct("product-nope", query("2027-04-01", "2027-04-15")),
    ).toBeNull();
  });
});
