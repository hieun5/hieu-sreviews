import { methodNotAllowed, options } from "@/server/api-errors";
import { recommendationApi } from "@/server/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return recommendationApi.projection(
    request,
    (await context.params).id,
    "feedback",
  );
}
export async function POST(request: Request, context: Context) {
  return recommendationApi.feedback(request, (await context.params).id);
}
export const PUT = methodNotAllowed("GET, HEAD, POST, OPTIONS");
export const PATCH = PUT;
export const DELETE = PUT;
export const OPTIONS = options("GET, HEAD, POST, OPTIONS");
