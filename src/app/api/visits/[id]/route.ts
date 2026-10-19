import { methodNotAllowed, options } from "@/server/api-errors";
import { journalApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return journalApi.getVisit(request, (await context.params).id);
}
export async function PATCH(request: Request, context: Context) {
  return journalApi.updateVisit(request, (await context.params).id);
}
export async function DELETE(request: Request, context: Context) {
  return journalApi.deleteVisit(request, (await context.params).id);
}
export const POST = methodNotAllowed("GET, HEAD, PATCH, DELETE, OPTIONS");
export const PUT = POST;
export const OPTIONS = options("GET, HEAD, PATCH, DELETE, OPTIONS");
