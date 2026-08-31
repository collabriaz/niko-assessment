import type { z } from "zod";
import type {
  assetSchema,
  bookingRequestSchema,
  bookingSchema,
  campaignSchema,
  capacityPoolSchema,
  clientRequestSchema,
  contractItemSchema,
  contractSchema,
  fixturesSchema,
  historyEntrySchema,
  holdSchema,
  indicativeRateSchema,
  locationSchema,
  mediaOwnerSchema,
  organisationSchema,
  outageSchema,
  productSchema,
  proofRecordSchema,
  serviceEventSchema,
  userSchema,
  workOrderSchema,
} from "./schemas";

export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type MediaOwner = z.infer<typeof mediaOwnerSchema>;
export type Location = z.infer<typeof locationSchema>;
export type IndicativeRate = z.infer<typeof indicativeRateSchema>;
export type Product = z.infer<typeof productSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type CapacityPool = z.infer<typeof capacityPoolSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Hold = z.infer<typeof holdSchema>;
export type Outage = z.infer<typeof outageSchema>;
export type Organisation = z.infer<typeof organisationSchema>;
export type User = z.infer<typeof userSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
export type ContractItem = z.infer<typeof contractItemSchema>;
export type Contract = z.infer<typeof contractSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type WorkOrder = z.infer<typeof workOrderSchema>;
export type ServiceEvent = z.infer<typeof serviceEventSchema>;
export type ClientRequest = z.infer<typeof clientRequestSchema>;
export type ProofRecord = z.infer<typeof proofRecordSchema>;
export type Fixtures = z.infer<typeof fixturesSchema>;

export type AllocationModel = Product["allocationModel"];
export type AvailabilityState =
  | "available"
  | "unavailable"
  | "confirmation_required";

export type AvailabilitySummary = {
  state: AvailabilityState;
  reason: string;
  calculatedAt: string;
  availableAssetCount: number | null;
  availableCapacity: number | null;
  totalCapacity: number | null;
  freshestVerificationAt: string | null;
};
