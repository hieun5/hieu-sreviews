import { apiErrorSchema, type ApiErrorBody } from "@/contracts/journal";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody["error"],
  ) {
    super(body.message);
  }
}

export async function requestJson<T>(
  url: string,
  init: RequestInit,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(value);
    if (error.success)
      throw new ApiRequestError(response.status, error.data.error);
    throw new Error("The server returned an unexpected error.");
  }
  return parse(value);
}
