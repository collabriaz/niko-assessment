import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, registerClient } from "@/data/users";
import { fixtureClock } from "@/domain/fixtures";
import { validationError } from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

const registerSchema = z.object({
  organisationName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.email(),
});

export async function POST(request: Request) {
  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = registerSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success)
    return validationError(
      "The registration details are not valid.",
      z.flattenError(parsed.error),
    );

  const result = await registerClient({
    ...parsed.data,
    idempotencyKey: key.data,
    now: fixtureClock,
  });

  if (result.status === "email_taken")
    return validationError("That email address is already registered.");

  const session = await getSession(result.userId);
  const response = NextResponse.json(session, {
    status: result.status === "created" ? 201 : 200,
  });

  response.cookies.set(SESSION_COOKIE, result.userId, SESSION_COOKIE_OPTIONS);

  return response;
}
