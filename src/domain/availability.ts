import type {
  Asset,
  AvailabilitySummary,
  Booking,
  CapacityPool,
  Hold,
  Outage,
  Product,
} from "./types";

const VERIFICATION_MAX_AGE_DAYS = 30;
const DAY_MS = 86_400_000;

export type AvailabilityInput = {
  product: Product;
  assets: Asset[];
  bookings: Booking[];
  holds: Hold[];
  outages: Outage[];
  pools: CapacityPool[];
  startDate: string;
  endDate: string;
  now: Date;
};

// Intervals are half-open: [start, end). Touching boundaries do not overlap.
export const overlaps = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => aStart < bEnd && bStart < aEnd;

// A hold blocks only while it has not expired. The `status` field lies: the
// fixtures contain an expired hold still marked "active".
const isLive = (hold: Hold, now: Date) => new Date(hold.expiresAt) > now;

const isStale = (verifiedAt: string | null, now: Date) =>
  verifiedAt === null ||
  now.getTime() - new Date(verifiedAt).getTime() >
    VERIFICATION_MAX_AGE_DAYS * DAY_MS;

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
      !bookings.some(
        (b) =>
          b.assetId === asset.id &&
          b.status === "confirmed" &&
          overlaps(b.startDate, b.endDate, startDate, endDate),
      ) &&
      !holds.some(
        (h) =>
          h.assetId === asset.id &&
          isLive(h, now) &&
          overlaps(h.startDate, h.endDate, startDate, endDate),
      ) &&
      !outages.some(
        (o) =>
          o.assetId === asset.id &&
          o.status === "confirmed" &&
          overlaps(o.startDate, o.endDate, startDate, endDate),
      ),
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
