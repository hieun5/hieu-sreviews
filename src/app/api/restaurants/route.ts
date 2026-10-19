import { methodNotAllowed, options } from "@/server/api-errors";
import { journalApi } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = journalApi.listRestaurants;
export const POST = journalApi.createRestaurant;
export const PUT = methodNotAllowed("GET, HEAD, POST, OPTIONS");
export const PATCH = PUT;
export const DELETE = PUT;
export const OPTIONS = options("GET, HEAD, POST, OPTIONS");
