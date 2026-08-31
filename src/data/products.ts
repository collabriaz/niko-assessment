import type {
  Asset,
  Booking,
  CapacityPool,
  Hold,
  Outage,
  Product,
} from "@prisma/client";
import {
  checkAssetAvailability,
  checkProductAvailability,
} from "../domain/availability";
import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";

const timestamp = (value: Date | null) => value?.toISOString() ?? null;

const toAsset = (asset: Asset) => ({
  id: asset.id,
  productId: asset.productId,
  status: asset.status,
  verifiedAt: timestamp(asset.verifiedAt),
  note: asset.note,
});

const toBooking = (booking: Booking) => ({
  assetId: booking.assetId,
  capacityPoolId: booking.capacityPoolId,
  capacityUnits: booking.capacityUnits,
  startDate: dateOnly(booking.startDate),
  endDate: dateOnly(booking.endDate),
  status: booking.status,
});

const toHold = (hold: Hold) => ({
  assetId: hold.assetId,
  capacityPoolId: hold.capacityPoolId,
  capacityUnits: hold.capacityUnits,
  startDate: dateOnly(hold.startDate),
  endDate: dateOnly(hold.endDate),
  expiresAt: hold.expiresAt.toISOString(),
});

const toOutage = (outage: Outage) => ({
  assetId: outage.assetId,
  startDate: dateOnly(outage.startDate),
  endDate: dateOnly(outage.endDate),
  reason: outage.reason,
  status: outage.status,
});

const toPool = (pool: CapacityPool) => ({
  id: pool.id,
  capacity: pool.capacity,
  status: pool.status,
  verifiedAt: timestamp(pool.verifiedAt),
});

// The rate is stored as five columns and rebuilt here. A null amount stays
// null so it renders as "Price on request" and never as zero.
const toIndicativeRate = (product: Product) => ({
  currency: product.rateCurrency,
  amount: product.rateAmount === null ? null : Number(product.rateAmount),
  unit: product.rateUnit,
  monthlyEquivalent:
    product.rateMonthlyEquivalent === null
      ? null
      : Number(product.rateMonthlyEquivalent),
  label: product.rateLabel,
});

type ProductRow = Product & {
  mediaOwner: { name: string };
  locations: { id: string; name: string }[];
  assets: (Asset & { bookings: Booking[]; holds: Hold[]; outages: Outage[] })[];
  capacityPool: (CapacityPool & { bookings: Booking[]; holds: Hold[] }) | null;
};

const inventory = (product: ProductRow) => ({
  assets: product.assets.map(toAsset),
  bookings: [
    ...product.assets.flatMap((asset) => asset.bookings),
    ...(product.capacityPool?.bookings ?? []),
  ].map(toBooking),
  holds: [
    ...product.assets.flatMap((asset) => asset.holds),
    ...(product.capacityPool?.holds ?? []),
  ].map(toHold),
  outages: product.assets.flatMap((asset) => asset.outages).map(toOutage),
  pools: product.capacityPool ? [toPool(product.capacityPool)] : [],
});

export const toSearchResult = (
  product: ProductRow,
  startDate: string,
  endDate: string,
  now: Date,
) => ({
  id: product.id,
  name: product.name,
  mediaOwnerName: product.mediaOwner.name,
  mediaType: product.mediaType,
  locationNames: product.locations.map((location) => location.name),
  allocationModel: product.allocationModel,
  indicativeRate: toIndicativeRate(product),
  minimumTermDays: product.minimumTermDays,
  availability: checkProductAvailability({
    product: {
      id: product.id,
      allocationModel: product.allocationModel,
      // The foreign key lives on CapacityPool.productId, so a Product row has
      // no capacityPoolId of its own.
      capacityPoolId: product.capacityPool?.id ?? null,
    },
    ...inventory(product),
    startDate,
    endDate,
    now,
  }),
});

export const withInventory = {
  mediaOwner: true,
  locations: true,
  assets: { include: { bookings: true, holds: true, outages: true } },
  capacityPool: { include: { bookings: true, holds: true } },
};

export type ProductQuery = {
  startDate: string;
  endDate: string;
  now: Date;
  mediaType?: string;
  locationId?: string;
  maxMonthlyBudget?: number;
};

export const listProducts = async (query: ProductQuery) => {
  const products = await prisma.product.findMany({
    where: {
      mediaType: query.mediaType,
      locations: query.locationId
        ? { some: { id: query.locationId } }
        : undefined,
      // SQL drops NULL comparisons, which is what keeps a price-on-request
      // product out of every budget filter.
      rateMonthlyEquivalent:
        query.maxMonthlyBudget === undefined
          ? undefined
          : { lte: query.maxMonthlyBudget },
    },
    include: withInventory,
    orderBy: { name: "asc" },
  });

  return products.map((product) =>
    toSearchResult(product, query.startDate, query.endDate, query.now),
  );
};

export const getProduct = async (productId: string, query: ProductQuery) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: withInventory,
  });

  if (!product) return null;

  const { bookings, holds, outages } = inventory(product);

  return {
    ...toSearchResult(product, query.startDate, query.endDate, query.now),
    description: product.description,
    creativeSpec: product.creativeSpec,
    assetOptions: product.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      status: asset.status,
      verifiedAt: timestamp(asset.verifiedAt),
      verificationSource: asset.verificationSource,
      note: asset.note,
      availability: checkAssetAvailability({
        asset: toAsset(asset),
        bookings,
        holds,
        outages,
        startDate: query.startDate,
        endDate: query.endDate,
        now: query.now,
      }),
    })),
  };
};
