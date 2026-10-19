import { z } from "zod";
import { DrizzleQueryError } from "drizzle-orm";
import type { ApiErrorBody, ApiErrorCode } from "@/contracts/journal";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly details?: ApiErrorBody["error"]["details"],
  ) {
    super(message);
  }
}

export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  code:
    "VALIDATION_ERROR" | "INVALID_QUERY" | "INVALID_ID" = "VALIDATION_ERROR",
): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    (fields[key] ??= []).push(issue.message);
  }
  throw new ApiError(
    code === "VALIDATION_ERROR" ? 422 : 400,
    code,
    "Check the request fields.",
    fields,
  );
}

export function parseQuery<T>(schema: z.ZodType<T>, request: Request): T {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (query.getAll(key).length > 1)
      throw new ApiError(
        400,
        "INVALID_QUERY",
        "Query parameters must not be repeated.",
        { [key]: ["Supply this parameter once."] },
      );
  }
  return parseInput(schema, Object.fromEntries(query), "INVALID_QUERY");
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN_ORIGIN",
      "Send journal changes from the app's own origin.",
    );
  }
}

export async function parseJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send an application/json request body.",
    );
  }
  if (Number(request.headers.get("content-length")) > 16_384)
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body exceeds 16 KiB.",
    );
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 16_384)
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body exceeds 16 KiB.",
    );
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Send a valid JSON body.");
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "private, no-store");
  return Response.json(body, { status, headers: responseHeaders });
}

export function options(allow: string) {
  return () =>
    new Response(null, {
      status: 204,
      headers: { Allow: allow, "Cache-Control": "private, no-store" },
    });
}

export function methodNotAllowed(allow: string) {
  return () =>
    json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "This method is not supported.",
          fieldErrors: {},
        },
      },
      405,
      { Allow: allow },
    );
}

export async function handleApi(
  work: () => Promise<Response>,
  reportError: (error: unknown) => void,
) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            fieldErrors: error.fieldErrors,
            ...(error.details ? { details: error.details } : {}),
          },
        },
        error.status,
      );
    reportError(error);
    const databaseError = error instanceof DrizzleQueryError;
    return json(
      {
        error: {
          code: databaseError ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
          message: databaseError
            ? "The journal database could not be reached. Try again shortly."
            : "The request could not be completed.",
          fieldErrors: {},
        },
      },
      databaseError ? 503 : 500,
    );
  }
}
