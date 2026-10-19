import { methodNotAllowed, options } from "@/server/api-errors";
import { reviewSummaryApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => context.params.then(({ id }) => reviewSummaryApi.generate(request, id));
export const GET = methodNotAllowed("POST, OPTIONS");
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = options("POST, OPTIONS");
