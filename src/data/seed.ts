import { fixtures } from "../domain/fixtures";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";
import { calendarDate } from "./dates";

const at = (value: string | null) => (value === null ? null : new Date(value));

export const seedDatabase = () =>
  prisma.$transaction(
    async (tx) => {
      await tx.proofRecord.deleteMany();
      await tx.serviceEvent.deleteMany();
      await tx.clientRequest.deleteMany();
      await tx.workOrder.deleteMany();
      await tx.campaign.deleteMany();
      await tx.contractItem.deleteMany();
      await tx.contract.deleteMany();
      await tx.shortlistItem.deleteMany();
      await tx.idempotencyKey.deleteMany();
      await tx.bookingRequest.deleteMany();
      await tx.user.deleteMany();
      await tx.organisation.deleteMany();
      await tx.outage.deleteMany();
      await tx.hold.deleteMany();
      await tx.booking.deleteMany();
      await tx.capacityPool.deleteMany();
      await tx.asset.deleteMany();
      await tx.product.deleteMany();
      await tx.location.deleteMany();
      await tx.mediaOwner.deleteMany();

      await tx.mediaOwner.createMany({ data: fixtures.mediaOwners });
      await tx.location.createMany({ data: fixtures.locations });

      for (const product of fixtures.products) {
        await tx.product.create({
          data: {
            id: product.id,
            name: product.name,
            mediaOwnerId: product.mediaOwnerId,
            mediaType: product.mediaType,
            allocationModel: product.allocationModel,
            description: product.description,
            minimumTermDays: product.minimumTermDays,
            rateCurrency: product.indicativeRate.currency,
            rateAmount: product.indicativeRate.amount,
            rateUnit: product.indicativeRate.unit,
            rateMonthlyEquivalent: product.indicativeRate.monthlyEquivalent,
            rateLabel: product.indicativeRate.label,
            creativeSpec: product.creativeSpec ?? undefined,
            locations: { connect: product.locationIds.map((id) => ({ id })) },
          },
        });
      }

      await tx.asset.createMany({
        data: fixtures.assets.map((asset) => ({
          id: asset.id,
          productId: asset.productId,
          locationId: asset.locationId,
          name: asset.name,
          status: asset.status,
          verifiedAt: at(asset.verifiedAt),
          verificationSource: asset.verificationSource,
          note: asset.note ?? null,
        })),
      });

      await tx.capacityPool.createMany({
        data: fixtures.capacityPools.map((pool) => ({
          ...pool,
          verifiedAt: at(pool.verifiedAt),
        })),
      });

      await tx.booking.createMany({
        data: fixtures.bookings.map((booking) => ({
          id: booking.id,
          campaignName: booking.campaignName,
          productId: booking.productId,
          assetId: booking.assetId ?? null,
          capacityPoolId: booking.capacityPoolId ?? null,
          capacityUnits: booking.capacityUnits ?? null,
          startDate: calendarDate(booking.startDate),
          endDate: calendarDate(booking.endDate),
          status: booking.status,
        })),
      });

      await tx.hold.createMany({
        data: fixtures.holds.map((hold) => ({
          id: hold.id,
          productId: hold.productId,
          assetId: hold.assetId ?? null,
          capacityPoolId: hold.capacityPoolId ?? null,
          capacityUnits: hold.capacityUnits ?? null,
          startDate: calendarDate(hold.startDate),
          endDate: calendarDate(hold.endDate),
          expiresAt: new Date(hold.expiresAt),
          status: hold.status,
        })),
      });

      await tx.outage.createMany({
        data: fixtures.outages.map((outage) => ({
          ...outage,
          startDate: calendarDate(outage.startDate),
          endDate: calendarDate(outage.endDate),
        })),
      });

      await tx.organisation.createMany({
        data: fixtures.organisations.map((organisation) => ({
          id: organisation.id,
          name: organisation.name,
          createdAt: new Date(organisation.createdAt),
        })),
      });

      await tx.user.createMany({ data: fixtures.users });

      await tx.bookingRequest.createMany({
        data: fixtures.bookingRequests.map((request) => ({
          id: request.id,
          organisationId: request.organisationId,
          productId: request.productId,
          requestedAssetId: request.requestedAssetId,
          advertiserName: request.advertiser.name,
          advertiserContactName: request.advertiser.contactName,
          advertiserEmail: request.advertiser.email,
          startDate: calendarDate(request.startDate),
          endDate: calendarDate(request.endDate),
          budget: request.budget,
          objective: request.objective,
          notes: request.notes,
          status: request.status,
          createdAt: new Date(request.createdAt),
          history: request.history,
        })),
      });

      await tx.idempotencyKey.createMany({
        data: fixtures.bookingRequests.map((request) => ({
          scope: IDEMPOTENCY_SCOPE.bookingRequest,
          key: request.idempotencyKey,
          recordId: request.id,
        })),
      });

      for (const contract of fixtures.contracts) {
        await tx.contract.create({
          data: {
            id: contract.id,
            organisationId: contract.organisationId,
            bookingRequestId: contract.bookingRequestId,
            status: contract.status,
            version: contract.version,
            startDate: calendarDate(contract.startDate),
            endDate: calendarDate(contract.endDate),
            currency: contract.currency,
            total: contract.total,
            issuedAt: at(contract.issuedAt),
            acceptedAt: at(contract.acceptedAt),
            activatedAt: at(contract.activatedAt),
            history: contract.history,
            items: { create: contract.items },
          },
        });
      }

      await tx.campaign.createMany({ data: fixtures.campaigns });

      await tx.workOrder.createMany({
        data: fixtures.workOrders.map((workOrder) => ({
          id: workOrder.id,
          campaignId: workOrder.campaignId,
          contractId: workOrder.contractId,
          organisationId: workOrder.organisationId,
          assetId: workOrder.assetId,
          assignedUserId: workOrder.assignedUserId,
          type: workOrder.type,
          status: workOrder.status,
          scheduledStart: new Date(workOrder.scheduledStart),
          scheduledEnd: new Date(workOrder.scheduledEnd),
          locationLabel: workOrder.locationLabel,
          instructions: workOrder.instructions,
          internalNotes: workOrder.internalNotes,
          completionNote: workOrder.completionNote,
          history: workOrder.history,
        })),
      });

      await tx.serviceEvent.createMany({
        data: fixtures.serviceEvents.map((event) => ({
          ...event,
          at: new Date(event.at),
        })),
      });

      await tx.clientRequest.createMany({
        data: fixtures.clientRequests.map((request) => ({
          ...request,
          createdAt: new Date(request.createdAt),
        })),
      });

      await tx.proofRecord.createMany({
        data: fixtures.proofRecords.map((proof) => ({
          ...proof,
          createdAt: new Date(proof.createdAt),
        })),
      });
    },
    { maxWait: 15_000, timeout: 120_000 },
  );
