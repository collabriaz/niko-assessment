import { cookies } from "next/headers";
import { getUser } from "@/data/users";

export const SESSION_COOKIE = "prototype-user-id";

const PROTOTYPE_USER_HEADER = "X-Prototype-User-Id";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
} as const;

const cookieUserId = async () => {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
};

export const currentUser = async (request: Request) => {
  const fromHeader = request.headers.get(PROTOTYPE_USER_HEADER);
  const userId = fromHeader ?? (await cookieUserId());

  if (!userId) return null;

  return getUser(userId);
};

export const currentClient = async (request: Request) => {
  const user = await currentUser(request);

  if (!user || user.role !== "client" || !user.organisationId) return null;

  return { user, organisationId: user.organisationId };
};

export const currentManager = async (request: Request) => {
  const user = await currentUser(request);

  if (!user || user.role !== "manager") return null;

  return user;
};

export const currentFitter = async (request: Request) => {
  const user = await currentUser(request);

  if (!user || user.role !== "fitter") return null;

  return user;
};

export const sessionUser = async () => {
  const userId = await cookieUserId();

  return userId ? getUser(userId) : null;
};
