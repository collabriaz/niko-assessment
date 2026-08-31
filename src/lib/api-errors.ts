const errorResponse = (
  status: number,
  code: string,
  message: string,
  details: unknown = null,
) => Response.json({ code, message, details }, { status });

export const validationError = (message: string, details: unknown = null) =>
  errorResponse(422, "VALIDATION_ERROR", message, details);

export const forbidden = (
  message = "You cannot access this organisation's record.",
) => errorResponse(403, "FORBIDDEN", message);

export const notFound = (message: string) =>
  errorResponse(404, "NOT_FOUND", message);

export const conflict = (code: string, message: string) =>
  errorResponse(409, code, message);

export const serviceUnavailable = () =>
  errorResponse(
    503,
    "SERVICE_UNAVAILABLE",
    "Please try again. The service is temporarily unavailable.",
  );
