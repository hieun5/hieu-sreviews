import { methodNotAllowed, options } from "@/server/api-errors";
import { journalApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return journalApi.getRestaurant(request, (await context.params).id);
}
export const POST = methodNotAllowed("GET, HEAD, OPTIONS");
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
export const OPTIONS = options("GET, HEAD, OPTIONS");
