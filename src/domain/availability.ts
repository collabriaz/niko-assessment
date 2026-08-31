import type { AvailabilitySummary } from "./types";

const VERIFICATION_MAX_AGE_DAYS = 30;
const DAY_MS = 86_400_000;

type AvailabilityAsset = {
  id: string;
  productId: string;
  status: string;
  verifiedAt: string | null;
  note?: string | null;
};

type AvailabilityBooking = {
  assetId?: string | null;
  capacityPoolId?: string | null;
  capacityUnits?: number | null;
  startDate: string;
  endDate: string;
  status: string;
};

type AvailabilityHold = {
  assetId?: string | null;
  capacityPoolId?: string | null;
  capacityUnits?: number | null;
  startDate: string;
  endDate: string;
  expiresAt: string;
};

type AvailabilityOutage = {
  assetId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
};

type AvailabilityPool = {
  id: string;
  capacity: number;
  status: string;
  verifiedAt: string | null;
};

export type AssetAvailabilityInput = {
  asset: AvailabilityAsset;
  bookings: AvailabilityBooking[];
  holds: AvailabilityHold[];
  outages: AvailabilityOutage[];
  startDate: string;
  endDate: string;
  now: Date;
};

export type AvailabilityInput = {
  product: {
    id: string;
    allocationModel: string;
    capacityPoolId?: string | null;
  };
  assets: AvailabilityAsset[];
  bookings: AvailabilityBooking[];
  holds: AvailabilityHold[];
  outages: AvailabilityOutage[];
  pools: AvailabilityPool[];
  startDate: string;
  endDate: string;
  now: Date;
};

export const overlaps = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => aStart < bEnd && bStart < aEnd;

const isLive = (hold: AvailabilityHold, now: Date) =>
  new Date(hold.expiresAt) > now;

const isStale = (verifiedAt: string | null, now: Date) =>
  verifiedAt === null ||
  now.getTime() - new Date(verifiedAt).getTime() >
    VERIFICATION_MAX_AGE_DAYS * DAY_MS;

const blockingReason = ({
  asset,
  bookings,
  holds,
  outages,
  startDate,
  endDate,
  now,
}: AssetAvailabilityInput) => {
  if (
    bookings.some(
      (b) =>
        b.assetId === asset.id &&
        b.status === "confirmed" &&
        overlaps(b.startDate, b.endDate, startDate, endDate),
    )
  )
    return "Booked for these dates.";

  if (
    holds.some(
      (h) =>
        h.assetId === asset.id &&
        isLive(h, now) &&
        overlaps(h.startDate, h.endDate, startDate, endDate),
    )
  )
    return "On hold for these dates.";

  const outage = outages.find(
    (o) =>
      o.assetId === asset.id &&
      o.status === "confirmed" &&
      overlaps(o.startDate, o.endDate, startDate, endDate),
  );
  if (outage) return `Out of service: ${outage.reason}.`;

  return null;
};

export const checkAssetAvailability = (
  input: AssetAvailabilityInput,
): AvailabilitySummary => {
  const { asset, now } = input;
  const base = {
    calculatedAt: now.toISOString(),
    availableCapacity: null,
    totalCapacity: null,
    freshestVerificationAt: asset.verifiedAt,
  };

  if (asset.status !== "active")
    return {
      ...base,
      state: "unavailable",
      availableAssetCount: 0,
      reason: "This asset is retired.",
    };

  const blocked = blockingReason(input);
  if (blocked)
    return {
      ...base,
      state: "unavailable",
      availableAssetCount: 0,
      reason: blocked,
    };

  if (isStale(asset.verifiedAt, now))
    return {
      ...base,
      state: "confirmation_required",
      availableAssetCount: 1,
      reason:
        asset.note ??
        "Asset verification is out of date. Confirm with the media owner before approval.",
    };

  return {
    ...base,
    state: "available",
    availableAssetCount: 1,
    reason: "Free for these dates.",
  };
};

export const checkProductAvailability = (
  input: AvailabilityInput,
): AvailabilitySummary =>
  input.product.allocationModel === "capacity_pool"
    ? checkPool(input)
    : checkExclusive(input);

const checkExclusive = ({
  product,
  assets,
  bookings,
  holds,
  outages,
  startDate,
  endDate,
  now,
}: AvailabilityInput): AvailabilitySummary => {
  const calculatedAt = now.toISOString();
  const candidates = assets.filter(
    (a) => a.productId === product.id && a.status === "active",
  );

  const free = candidates.filter(
    (asset) =>
      blockingReason({
        asset,
        bookings,
        holds,
        outages,
        startDate,
        endDate,
        now,
      }) === null,
  );

  const base = {
    calculatedAt,
    availableAssetCount: free.length,
    availableCapacity: null,
    totalCapacity: null,
  };

  if (free.length === 0) {
    return {
      ...base,
      state: "unavailable",
      freshestVerificationAt: null,
      reason:
        candidates.length === 0
          ? "This product has no active assets."
          : `All ${candidates.length} active assets are booked, held or out of service for these dates.`,
    };
  }

  const verifications = free.map((a) => a.verifiedAt).filter((v) => v !== null);
  const freshestVerificationAt = verifications.sort().at(-1) ?? null;

  if (isStale(freshestVerificationAt, now)) {
    return {
      ...base,
      state: "confirmation_required",
      freshestVerificationAt,
      reason:
        free.find((a) => a.note)?.note ??
        "Asset verification is out of date. Confirm with the media owner before approval.",
    };
  }

  return {
    ...base,
    state: "available",
    freshestVerificationAt,
    reason: `${free.length} of ${candidates.length} assets free for these dates.`,
  };
};

const checkPool = ({
  product,
  bookings,
  holds,
  pools,
  startDate,
  endDate,
  now,
}: AvailabilityInput): AvailabilitySummary => {
  const calculatedAt = now.toISOString();
  const pool = pools.find((p) => p.id === product.capacityPoolId);

  if (!pool || pool.status !== "active") {
    return {
      state: "unavailable",
      reason: "No active capacity pool is configured for this product.",
      calculatedAt,
      availableAssetCount: null,
      availableCapacity: null,
      totalCapacity: null,
      freshestVerificationAt: null,
    };
  }

  const booked = bookings
    .filter(
      (b) =>
        b.capacityPoolId === pool.id &&
        b.status === "confirmed" &&
        overlaps(b.startDate, b.endDate, startDate, endDate),
    )
    .reduce((total, b) => total + (b.capacityUnits ?? 1), 0);

  const held = holds
    .filter(
      (h) =>
        h.capacityPoolId === pool.id &&
        isLive(h, now) &&
        overlaps(h.startDate, h.endDate, startDate, endDate),
    )
    .reduce((total, h) => total + (h.capacityUnits ?? 1), 0);

  const used = booked + held;
  const base = {
    calculatedAt,
    availableAssetCount: null,
    availableCapacity: Math.max(pool.capacity - used, 0),
    totalCapacity: pool.capacity,
    freshestVerificationAt: pool.verifiedAt,
  };

  if (used >= pool.capacity) {
    return {
      ...base,
      state: "unavailable",
      reason: `Capacity pool is full: ${used} of ${pool.capacity} units used.`,
    };
  }

  if (isStale(pool.verifiedAt, now)) {
    return {
      ...base,
      state: "confirmation_required",
      reason:
        "Pool capacity verification is out of date. Confirm with the media owner.",
    };
  }

  return {
    ...base,
    state: "available",
    reason: `${base.availableCapacity} of ${pool.capacity} units free for these dates.`,
  };
};
