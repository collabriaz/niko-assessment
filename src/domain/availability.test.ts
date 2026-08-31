import { describe, expect, it } from "vitest";
import type { AvailabilityInput } from "./availability";
import {
  checkAssetAvailability,
  checkProductAvailability,
  overlaps,
} from "./availability";
import { fixtureClock, fixtures } from "./fixtures";

const check = (productId: string, startDate: string, endDate: string) => {
  const product = fixtures.products.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product ${productId}`);

  const input: AvailabilityInput = {
    product,
    assets: fixtures.assets,
    bookings: fixtures.bookings,
    holds: fixtures.holds,
    outages: fixtures.outages,
    pools: fixtures.capacityPools,
    startDate,
    endDate,
    now: fixtureClock,
  };
  return checkProductAvailability(input);
};

const checkAsset = (assetId: string, startDate: string, endDate: string) => {
  const asset = fixtures.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error(`Unknown asset ${assetId}`);

  return checkAssetAvailability({
    asset,
    bookings: fixtures.bookings,
    holds: fixtures.holds,
    outages: fixtures.outages,
    startDate,
    endDate,
    now: fixtureClock,
  });
};

describe("overlaps", () => {
  it("treats intervals as half-open, so touching boundaries do not overlap", () => {
    expect(
      overlaps("2027-02-01", "2027-03-01", "2027-03-01", "2027-03-05"),
    ).toBe(false);
    expect(
      overlaps("2027-03-01", "2027-03-05", "2027-03-04", "2027-03-10"),
    ).toBe(true);
  });
});

describe("exclusive assets", () => {
  it("frees assets whose bookings only touch the query boundary", () => {
    const result = check("product-bus-rear", "2027-03-01", "2027-03-05");

    expect(result.state).toBe("available");
    expect(result.availableAssetCount).toBe(2);
  });

  it("frees an asset whose outage ends on the query start", () => {
    const result = check("product-bus-rear", "2027-02-20", "2027-02-25");

    expect(result.state).toBe("available");
    expect(result.availableAssetCount).toBe(1);
  });

  it("reports the seeded booking request as unavailable", () => {
    const result = check("product-bus-rear", "2027-02-12", "2027-02-18");

    expect(result.state).toBe("unavailable");
    expect(result.availableAssetCount).toBe(0);
  });

  it("ignores retired assets", () => {
    const result = check("product-bus-wrap", "2027-02-01", "2027-03-01");

    expect(result.state).toBe("unavailable");
    expect(result.availableAssetCount).toBe(0);
  });

  it("respects a live asset hold", () => {
    const result = check("product-bus-rear", "2027-03-06", "2027-03-10");

    expect(result.state).toBe("available");
    expect(result.availableAssetCount).toBe(1);
  });
});

describe("capacity pools", () => {
  it("drops expired holds and excludes bookings that start on the query end", () => {
    const result = check("product-hub-screen", "2027-02-01", "2027-02-20");

    expect(result.state).toBe("available");
    expect(result.availableCapacity).toBe(1);
    expect(result.totalCapacity).toBe(4);
  });

  it("counts a live hold against capacity", () => {
    const result = check("product-hub-screen", "2027-02-10", "2027-02-14");

    expect(result.availableCapacity).toBe(2);
  });

  it("is unavailable when the pool is exactly full", () => {
    const result = check("product-hub-screen", "2027-02-20", "2027-02-28");

    expect(result.state).toBe("unavailable");
    expect(result.availableCapacity).toBe(0);
  });

  it("is available once the overlapping window clears", () => {
    const result = check("product-hub-screen", "2027-04-01", "2027-04-15");

    expect(result.state).toBe("available");
    expect(result.availableCapacity).toBe(4);
  });
});

describe("stale verification", () => {
  it("requires confirmation when the only free asset has stale verification", () => {
    const result = check("product-hub-door", "2027-02-01", "2027-05-01");

    expect(result.state).toBe("confirmation_required");
    expect(result.availableAssetCount).toBe(1);
    expect(result.reason).toBe(
      "Owner confirmation recommended before approval.",
    );
  });

  it("stays available while a freshly verified asset is free", () => {
    const result = check("product-hub-door", "2027-02-01", "2027-02-20");

    expect(result.state).toBe("available");
    expect(result.availableAssetCount).toBe(2);
  });
});

describe("single asset availability", () => {
  it("blocks an asset held by a hold that has not expired", () => {
    const result = checkAsset("asset-bus-103-rear", "2027-03-06", "2027-03-10");

    expect(result.state).toBe("unavailable");
    expect(result.availableAssetCount).toBe(0);
  });

  it("frees a sibling asset over the same dates", () => {
    const result = checkAsset("asset-bus-101-rear", "2027-03-06", "2027-03-10");

    expect(result.state).toBe("available");
    expect(result.availableAssetCount).toBe(1);
  });

  it("frees an asset on the day its outage ends", () => {
    const result = checkAsset("asset-bus-103-rear", "2027-02-20", "2027-02-25");

    expect(result.state).toBe("available");
  });

  it("reports a retired asset as unavailable", () => {
    const result = checkAsset("asset-bus-202-wrap", "2027-04-01", "2027-04-10");

    expect(result.state).toBe("unavailable");
    expect(result.reason).toBe("This asset is retired.");
  });

  it("requires confirmation for a free asset with stale verification", () => {
    const result = checkAsset("asset-door-b", "2027-02-01", "2027-02-20");

    expect(result.state).toBe("confirmation_required");
    expect(result.reason).toBe(
      "Owner confirmation recommended before approval.",
    );
  });

  it("never names the campaign occupying a booked asset", () => {
    const result = checkAsset("asset-bus-101-rear", "2027-02-12", "2027-02-18");

    expect(result.state).toBe("unavailable");
    expect(result.reason).toBe("Booked for these dates.");
    expect(result.reason).not.toContain("Northstar");
  });
});
