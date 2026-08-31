import { prisma } from "../lib/prisma";
import { calendarDate, dateOnly } from "./dates";
import { toSearchResult, withInventory } from "./products";

export const listShortlist = async (organisationId: string, now: Date) => {
  const items = await prisma.shortlistItem.findMany({
    where: { organisationId },
    include: { product: { include: withInventory } },
    orderBy: { createdAt: "asc" },
  });

  return items.map((item) => {
    const startDate = dateOnly(item.startDate);
    const endDate = dateOnly(item.endDate);

    return {
      id: item.id,
      startDate,
      endDate,
      createdAt: item.createdAt.toISOString(),
      product: toSearchResult(item.product, startDate, endDate, now),
    };
  });
};

export const addToShortlist = (
  organisationId: string,
  productId: string,
  startDate: string,
  endDate: string,
) =>
  prisma.shortlistItem.upsert({
    where: { organisationId_productId: { organisationId, productId } },
    create: {
      organisationId,
      productId,
      startDate: calendarDate(startDate),
      endDate: calendarDate(endDate),
    },
    update: {
      startDate: calendarDate(startDate),
      endDate: calendarDate(endDate),
    },
  });

export const removeFromShortlist = async (
  organisationId: string,
  productId: string,
) => {
  const { count } = await prisma.shortlistItem.deleteMany({
    where: { organisationId, productId },
  });

  return count > 0;
};

export const isShortlisted = async (
  organisationId: string,
  productId: string,
) =>
  (await prisma.shortlistItem.findUnique({
    where: { organisationId_productId: { organisationId, productId } },
    select: { id: true },
  })) !== null;
