export type AllocationModel = "exclusive_asset" | "capacity_pool";
export type AvailabilityState =
  | "available"
  | "unavailable"
  | "confirmation_required";

export type IndicativeRate = {
  currency: "GBP";
  amount: number | null;
  unit: string | null;
  monthlyEquivalent: number | null;
  label: string;
};

export type Product = {
  id: string;
  name: string;
  mediaOwnerId: string;
  mediaType: string;
  locationIds: string[];
  allocationModel: AllocationModel;
  capacityPoolId?: string;
  description: string;
  indicativeRate: IndicativeRate;
  minimumTermDays: number;
  creativeSpec: Record<string, unknown> | null;
};

export type Asset = {
  id: string;
  productId: string;
  name: string;
  locationId: string;
  status: "active" | "retired";
  verifiedAt: string | null;
  verificationSource: string | null;
  note?: string;
};

export type CapacityPool = {
  id: string;
  productId: string;
  name: string;
  locationId: string;
  capacity: number;
  status: "active" | "retired";
  verifiedAt: string | null;
  verificationSource: string | null;
};

export type Booking = {
  id: string;
  campaignName: string;
  productId: string;
  assetId?: string;
  capacityPoolId?: string;
  capacityUnits?: number;
  startDate: string;
  endDate: string;
  status: "confirmed" | "cancelled";
};

export type Hold = {
  id: string;
  productId: string;
  assetId?: string;
  capacityPoolId?: string;
  capacityUnits?: number;
  startDate: string;
  endDate: string;
  expiresAt: string;
  status: string;
};

export type Outage = {
  id: string;
  assetId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "confirmed" | "provisional";
};

export type AvailabilitySummary = {
  state: AvailabilityState;
  reason: string;
  calculatedAt: string;
  availableAssetCount: number | null;
  availableCapacity: number | null;
  totalCapacity: number | null;
  freshestVerificationAt: string | null;
};

export type Fixtures = {
  schemaVersion: string;
  fixtureClock: string;
  currency: "GBP";
  products: Product[];
  assets: Asset[];
  capacityPools: CapacityPool[];
  bookings: Booking[];
  holds: Hold[];
  outages: Outage[];
};
