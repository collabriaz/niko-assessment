import { prisma } from "../lib/prisma";
import { dateOnly } from "./dates";

export const ORGANISATION_INCLUDE = {
  _count: { select: { contracts: true } },
};

type OrganisationRow = {
  id: string;
  name: string;
  createdAt: Date;
  _count: { contracts: number };
};

export const toOrganisation = (organisation: OrganisationRow) => ({
  id: organisation.id,
  name: organisation.name,
  createdAt: organisation.createdAt.toISOString(),
  contractCount: organisation._count.contracts,
});

export const getOrganisationForManagement = async (organisationId: string) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    include: {
      ...ORGANISATION_INCLUDE,
      users: { orderBy: { name: "asc" } },
      contracts: { orderBy: { startDate: "desc" } },
      bookingRequests: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organisation) return null;

  return {
    ...toOrganisation(organisation),
    users: organisation.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    })),
    contracts: organisation.contracts.map((contract) => ({
      id: contract.id,
      status: contract.status,
      startDate: dateOnly(contract.startDate),
      endDate: dateOnly(contract.endDate),
      total: Number(contract.total),
      currency: contract.currency,
    })),
    bookingRequests: organisation.bookingRequests.map((request) => ({
      id: request.id,
      productName: request.product.name,
      startDate: dateOnly(request.startDate),
      endDate: dateOnly(request.endDate),
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
  };
};
