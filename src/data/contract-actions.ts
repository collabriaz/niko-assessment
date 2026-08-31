import { randomUUID } from "node:crypto";
import {
  checkAssetAvailability,
  checkProductAvailability,
} from "../domain/availability";
import {
  acceptedCampaignStage,
  acceptedContractStatus,
  type ClientAction,
  clientActionAllowed,
} from "../domain/contracts";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";
import { toAvailabilityInventory, withInventory } from "./products";

const DEFAULT_SUMMARY: Record<string, string> = {
  request_changes: "The client asked for changes to this contract.",
  request_cancellation: "The client asked to cancel this contract.",
};

const REQUEST_TYPE: Record<string, string> = {
  request_changes: "contract_change",
  request_cancellation: "contract_cancellation",
};

type ActionInput = {
  organisationId: string;
  contractId: string;
  action: ClientAction;
  note: string | null;
  idempotencyKey: string;
  now: Date;
};

export const applyClientContractAction = (input: ActionInput) =>
  prisma.$transaction(
    async (tx) => {
      const key = {
        scope: IDEMPOTENCY_SCOPE.clientContractAction,
        key: input.idempotencyKey,
      };

      if (await tx.idempotencyKey.findUnique({ where: { scope_key: key } }))
        return { status: "existing" } as const;

      const contract = await tx.contract.findFirst({
        where: { id: input.contractId, organisationId: input.organisationId },
        include: { items: true, campaigns: true },
      });

      if (!contract) return { status: "not_found" } as const;

      if (!clientActionAllowed(contract.status, input.action))
        return {
          status: "wrong_state",
          contractStatus: contract.status,
        } as const;

      const startDate = dateOnly(contract.startDate);
      const endDate = dateOnly(contract.endDate);
      const entry = {
        at: input.now.toISOString(),
        actor: "client",
        action: input.action,
        note: input.note,
      };
      const history = [
        ...(Array.isArray(contract.history) ? contract.history : []),
        entry,
      ];

      if (input.action === "accept") {
        for (const item of contract.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: withInventory,
          });

          if (!product)
            return {
              status: "inventory_conflict",
              reason: "A product on this contract no longer exists.",
            } as const;

          const inventory = toAvailabilityInventory(product);
          const asset = item.assetId
            ? inventory.assets.find((option) => option.id === item.assetId)
            : null;

          if (item.assetId && !asset)
            return {
              status: "inventory_conflict",
              reason: "An asset on this contract no longer exists.",
            } as const;

          const result = asset
            ? checkAssetAvailability({
                asset,
                bookings: inventory.bookings,
                holds: inventory.holds,
                outages: inventory.outages,
                startDate,
                endDate,
                now: input.now,
              })
            : checkProductAvailability({
                product: {
                  id: product.id,
                  allocationModel: product.allocationModel,
                  capacityPoolId: product.capacityPool?.id ?? null,
                },
                ...inventory,
                startDate,
                endDate,
                now: input.now,
              });

          if (result.state === "unavailable")
            return {
              status: "inventory_conflict",
              reason: result.reason,
            } as const;
        }

        const campaign = contract.campaigns.at(0) ?? null;
        const status = acceptedContractStatus(startDate, input.now);
        let bookingId: string | null = null;

        for (const item of contract.items) {
          const booking = await tx.booking.create({
            data: {
              id: `booking-${randomUUID()}`,
              campaignName: campaign?.name ?? `Contract ${contract.id}`,
              productId: item.productId,
              assetId: item.assetId,
              capacityPoolId: item.capacityPoolId,
              capacityUnits: item.capacityPoolId ? item.quantity : null,
              startDate: contract.startDate,
              endDate: contract.endDate,
              status: "confirmed",
            },
          });

          bookingId ??= booking.id;
        }

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status,
            acceptedAt: input.now,
            activatedAt: status === "active" ? input.now : null,
            history,
          },
        });

        if (campaign)
          await tx.campaign.update({
            where: { id: campaign.id },
            data: { ...acceptedCampaignStage(status), bookingId },
          });

        await tx.serviceEvent.create({
          data: {
            organisationId: contract.organisationId,
            contractId: contract.id,
            campaignId: campaign?.id ?? null,
            at: input.now,
            type: "contract_accepted",
            title: "Contract accepted",
            clientVisible: true,
            clientSummary: "Your advertising contract has been accepted.",
          },
        });
      } else {
        await tx.clientRequest.create({
          data: {
            organisationId: contract.organisationId,
            contractId: contract.id,
            type: REQUEST_TYPE[input.action],
            status: "submitted",
            summary: input.note ?? DEFAULT_SUMMARY[input.action],
            createdAt: input.now,
            history: [
              {
                at: input.now.toISOString(),
                actor: "client",
                action: "submitted",
                note: input.note,
              },
            ],
          },
        });

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            history,
            ...(input.action === "request_changes"
              ? { status: "change_requested" }
              : {}),
          },
        });
      }

      await tx.idempotencyKey.create({
        data: { ...key, recordId: contract.id },
      });

      return { status: "applied" } as const;
    },
    { timeout: 30_000 },
  );
