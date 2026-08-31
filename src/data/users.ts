import { randomUUID } from "node:crypto";
import { IDEMPOTENCY_SCOPE } from "../lib/idempotency";
import { prisma } from "../lib/prisma";

export const getUser = (id: string) =>
  prisma.user.findUnique({ where: { id } });

export const listPrototypeUsers = () =>
  prisma.user.findMany({
    include: { organisation: { select: { id: true, name: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

export const listFitters = () =>
  prisma.user.findMany({
    where: { role: "fitter", status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

export const getSession = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organisation: true },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organisationId: user.organisationId,
      status: user.status,
    },
    organisation: user.organisation
      ? {
          id: user.organisation.id,
          name: user.organisation.name,
          createdAt: user.organisation.createdAt.toISOString(),
          contractCount: await prisma.contract.count({
            where: { organisationId: user.organisation.id },
          }),
        }
      : null,
  };
};

type RegisterInput = {
  organisationName: string;
  contactName: string;
  email: string;
  idempotencyKey: string;
  now: Date;
};

export const registerClient = (input: RegisterInput) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({
      where: {
        scope_key: {
          scope: IDEMPOTENCY_SCOPE.register,
          key: input.idempotencyKey,
        },
      },
    });

    if (existing)
      return { status: "existing", userId: existing.recordId } as const;

    const emailTaken = await tx.user.findUnique({
      where: { email: input.email },
    });

    if (emailTaken) return { status: "email_taken" } as const;

    const organisation = await tx.organisation.create({
      data: {
        id: `org-${randomUUID()}`,
        name: input.organisationName,
        createdAt: input.now,
      },
    });

    const user = await tx.user.create({
      data: {
        id: `user-${randomUUID()}`,
        name: input.contactName,
        email: input.email,
        role: "client",
        organisationId: organisation.id,
        status: "active",
      },
    });

    await tx.idempotencyKey.create({
      data: {
        scope: IDEMPOTENCY_SCOPE.register,
        key: input.idempotencyKey,
        recordId: user.id,
      },
    });

    return { status: "created", userId: user.id } as const;
  });
