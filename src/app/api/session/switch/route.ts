import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/data/users";
import { notFound, validationError } from "@/lib/api-errors";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

const switchSchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = switchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success)
    return validationError(
      "A userId is required.",
      z.flattenError(parsed.error),
    );

  const session = await getSession(parsed.data.userId);

  if (!session) return notFound("That prototype user does not exist.");

  const response = NextResponse.json(session);

  response.cookies.set(
    SESSION_COOKIE,
    parsed.data.userId,
    SESSION_COOKIE_OPTIONS,
  );

  return response;
}

export async function DELETE() {
  const response = new Response(null, { status: 204 });

  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );

  return response;
}
