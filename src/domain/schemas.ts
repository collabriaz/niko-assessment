import { z } from "zod";

const dateOnly = z.iso.date();
const timestamp = z.iso.datetime();

export const historyEntrySchema = z.object({
  at: timestamp,
  actor: z.string(),
  action: z.string(),
  note: z.string().nullable(),
});

export const mediaOwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const indicativeRateSchema = z.object({
  currency: z.literal("GBP"),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  monthlyEquivalent: z.number().nullable(),
  label: z.string(),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaOwnerId: z.string(),
  mediaType: z.string(),
  locationIds: z.array(z.string()),
  allocationModel: z.enum(["exclusive_asset", "capacity_pool"]),
  capacityPoolId: z.string().optional(),
  description: z.string(),
  indicativeRate: indicativeRateSchema,
  minimumTermDays: z.number().int(),
  creativeSpec: z.record(z.string(), z.json()).nullable(),
});

export const assetSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  locationId: z.string(),
  status: z.enum(["active", "retired"]),
  verifiedAt: timestamp.nullable(),
  verificationSource: z.string().nullable(),
  note: z.string().optional(),
});

export const capacityPoolSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  locationId: z.string(),
  capacity: z.number().int(),
  status: z.enum(["active", "retired"]),
  verifiedAt: timestamp.nullable(),
  verificationSource: z.string().nullable(),
});

export const bookingSchema = z.object({
  id: z.string(),
  campaignName: z.string(),
  productId: z.string(),
  assetId: z.string().optional(),
  capacityPoolId: z.string().optional(),
  capacityUnits: z.number().int().optional(),
  startDate: dateOnly,
  endDate: dateOnly,
  status: z.enum(["confirmed", "cancelled"]),
});

export const holdSchema = z.object({
  id: z.string(),
  productId: z.string(),
  assetId: z.string().optional(),
  capacityPoolId: z.string().optional(),
  capacityUnits: z.number().int().optional(),
  startDate: dateOnly,
  endDate: dateOnly,
  expiresAt: timestamp,
  status: z.string(),
});

export const outageSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  startDate: dateOnly,
  endDate: dateOnly,
  reason: z.string(),
  status: z.enum(["confirmed", "provisional"]),
});

export const organisationSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: timestamp,
  contractCount: z.number().int(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(["client", "manager", "fitter"]),
  organisationId: z.string().nullable(),
  status: z.string(),
});

export const bookingRequestSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  organisationId: z.string(),
  productId: z.string(),
  requestedAssetId: z.string().nullable(),
  advertiser: z.object({
    name: z.string(),
    contactName: z.string(),
    email: z.email(),
  }),
  startDate: dateOnly,
  endDate: dateOnly,
  budget: z.number().nullable(),
  objective: z.string(),
  notes: z.string().nullable(),
  status: z.string(),
  createdAt: timestamp,
  history: z.array(historyEntrySchema),
});

export const contractItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  assetId: z.string().nullable(),
  quantity: z.number().int(),
  unitRate: z.number(),
  rateUnit: z.string(),
  lineTotal: z.number(),
});

export const contractSchema = z.object({
  id: z.string(),
  organisationId: z.string(),
  bookingRequestId: z.string().nullable(),
  status: z.enum([
    "draft",
    "issued",
    "change_requested",
    "accepted",
    "active",
    "completed",
    "cancelled",
  ]),
  version: z.number().int(),
  startDate: dateOnly,
  endDate: dateOnly,
  currency: z.literal("GBP"),
  total: z.number(),
  issuedAt: timestamp.nullable(),
  acceptedAt: timestamp.nullable(),
  activatedAt: timestamp.nullable(),
  items: z.array(contractItemSchema),
  history: z.array(historyEntrySchema),
});

export const campaignSchema = z.object({
  id: z.string(),
  organisationId: z.string(),
  contractId: z.string(),
  bookingId: z.string().nullable(),
  name: z.string(),
  status: z.string(),
  currentStage: z.string(),
  clientVisible: z.boolean(),
});

export const workOrderSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  contractId: z.string(),
  organisationId: z.string(),
  type: z.enum([
    "survey",
    "production",
    "installation",
    "maintenance",
    "removal",
  ]),
  status: z.enum([
    "draft",
    "assigned",
    "travelling",
    "on_site",
    "blocked",
    "completed",
  ]),
  assignedUserId: z.string().nullable(),
  assetId: z.string(),
  scheduledStart: timestamp,
  scheduledEnd: timestamp,
  locationLabel: z.string(),
  instructions: z.string(),
  internalNotes: z.string().nullable(),
  completionNote: z.string().nullable(),
  proofRecordIds: z.array(z.string()),
  history: z.array(historyEntrySchema),
});

export const serviceEventSchema = z.object({
  id: z.string(),
  organisationId: z.string(),
  contractId: z.string().nullable(),
  campaignId: z.string().nullable(),
  workOrderId: z.string().nullable(),
  at: timestamp,
  type: z.string(),
  title: z.string(),
  clientVisible: z.boolean(),
  clientSummary: z.string().nullable(),
});

export const clientRequestSchema = z.object({
  id: z.string(),
  organisationId: z.string(),
  contractId: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  createdAt: timestamp,
  summary: z.string(),
  history: z.array(historyEntrySchema),
});

export const proofRecordSchema = z.object({
  id: z.string(),
  workOrderId: z.string(),
  createdByUserId: z.string(),
  fileName: z.string(),
  previewUrl: z.string().nullable(),
  completionNote: z.string(),
  createdAt: timestamp,
});

export const fixturesSchema = z.object({
  schemaVersion: z.string(),
  fixtureClock: timestamp,
  currency: z.literal("GBP"),
  dateInterval: z.string(),
  mediaOwners: z.array(mediaOwnerSchema),
  locations: z.array(locationSchema),
  products: z.array(productSchema),
  assets: z.array(assetSchema),
  capacityPools: z.array(capacityPoolSchema),
  bookings: z.array(bookingSchema),
  holds: z.array(holdSchema),
  outages: z.array(outageSchema),
  bookingRequests: z.array(bookingRequestSchema),
  users: z.array(userSchema),
  organisations: z.array(organisationSchema),
  contracts: z.array(contractSchema),
  campaigns: z.array(campaignSchema),
  workOrders: z.array(workOrderSchema),
  serviceEvents: z.array(serviceEventSchema),
  clientRequests: z.array(clientRequestSchema),
  proofRecords: z.array(proofRecordSchema),
});
