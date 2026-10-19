import { methodNotAllowed, options } from "@/server/api-errors";
import { reportingApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = reportingApi.analytics;
export const POST = methodNotAllowed("GET, HEAD, OPTIONS");
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
export const OPTIONS = options("GET, HEAD, OPTIONS");
