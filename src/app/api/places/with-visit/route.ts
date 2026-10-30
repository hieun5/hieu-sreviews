import { methodNotAllowed, options } from "@/server/api-errors";
import { journalApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = journalApi.createPlaceWithVisit;
export const GET = methodNotAllowed("POST, OPTIONS");
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = options("POST, OPTIONS");
