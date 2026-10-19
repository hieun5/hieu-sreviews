import {
  externalSearchQuerySchema,
  externalSearchResponseSchema,
  idSchema,
  profileIdSchema,
  restaurantCreateSchema,
  restaurantListQuerySchema,
  visitCreateSchema,
  visitListQuerySchema,
  visitUpdateSchema,
} from "@/contracts/journal";
import {
  ApiError,
  assertSameOrigin,
  handleApi,
  json,
  parseInput,
  parseJson,
  parseQuery,
} from "./api-errors";
import type { JournalRepository } from "./journal-repository";
import { serializeRestaurant, serializeVisit } from "./journal-serialization";
import type { PlaceProviderAdapter } from "./place-provider";

type Dependencies = {
  repository: () => JournalRepository;
  selectedProfile: () => Promise<string | undefined>;
  today: () => string;
  provider: () => PlaceProviderAdapter | null;
  onMutation: () => void | Promise<void>;
  reportError: (error: unknown) => void;
};

function pagination(query: { page: number; pageSize: number }, total: number) {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    hasNextPage: query.page * query.pageSize < total,
  };
}

export function createJournalApi(deps: Dependencies) {
  async function profile() {
    const result = profileIdSchema.safeParse(await deps.selectedProfile());
    if (!result.success)
      throw new ApiError(
        401,
        "PROFILE_REQUIRED",
        "Select a predefined journal profile first.",
      );
    return result.data;
  }

  const handle = (work: () => Promise<Response>) =>
    handleApi(work, deps.reportError);
  const changed = async () => {
    // The mutation is already committed. Cache invalidation failure must not
    // return a misleading write failure that encourages a duplicate retry.
    try {
      await deps.onMutation();
    } catch (error) {
      deps.reportError(error);
    }
  };

  return {
    listRestaurants: (request: Request) =>
      handle(async () => {
        await profile();
        const query = parseQuery(restaurantListQuerySchema, request);
        const result = await deps.repository().listRestaurants(query);
        return json({
          data: result.rows.map((row) =>
            serializeRestaurant(row, result.history),
          ),
          pagination: pagination(query, result.total),
        });
      }),
    createRestaurant: (request: Request) =>
      handle(async () => {
        assertSameOrigin(request);
        await profile();
        const input = parseInput(
          restaurantCreateSchema,
          await parseJson(request),
        );
        const created = await deps.repository().createRestaurant(input);
        await changed();
        return json({ data: serializeRestaurant(created, []) }, 201, {
          Location: `/api/restaurants/${created.id}`,
        });
      }),
    getRestaurant: (request: Request, id: string) =>
      handle(async () => {
        await profile();
        const validId = parseInput(idSchema, id, "INVALID_ID");
        const repository = deps.repository();
        const restaurant = await repository.restaurant(validId);
        if (!restaurant)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "The saved restaurant could not be found.",
          );
        return json({
          data: serializeRestaurant(
            restaurant,
            await repository.history([validId]),
          ),
        });
      }),
    listVisits: (request: Request) =>
      handle(async () => {
        await profile();
        const query = parseQuery(visitListQuerySchema, request);
        const repository = deps.repository();
        if (
          query.restaurantId &&
          !(await repository.restaurant(query.restaurantId))
        )
          throw new ApiError(
            404,
            "NOT_FOUND",
            "The saved restaurant could not be found.",
          );
        const result = await repository.listVisits(query);
        return json({
          data: result.rows.map(serializeVisit),
          pagination: pagination(query, result.total),
        });
      }),
    createVisit: (request: Request) =>
      handle(async () => {
        assertSameOrigin(request);
        const selected = await profile();
        const input = parseInput(
          visitCreateSchema(deps.today()),
          await parseJson(request),
        );
        const created = await deps.repository().createVisit(input, selected);
        await changed();
        return json({ data: serializeVisit(created) }, 201, {
          Location: `/api/visits/${created.id}`,
        });
      }),
    getVisit: (request: Request, id: string) =>
      handle(async () => {
        await profile();
        const validId = parseInput(idSchema, id, "INVALID_ID");
        const visit = await deps.repository().visit(validId);
        if (!visit)
          throw new ApiError(404, "NOT_FOUND", "The visit could not be found.");
        return json({ data: serializeVisit(visit) });
      }),
    updateVisit: (request: Request, id: string) =>
      handle(async () => {
        assertSameOrigin(request);
        const selected = await profile();
        const validId = parseInput(idSchema, id, "INVALID_ID");
        const input = parseInput(
          visitUpdateSchema(deps.today()),
          await parseJson(request),
        );
        const updated = await deps
          .repository()
          .updateVisit(validId, input, selected);
        await changed();
        return json({ data: serializeVisit(updated) });
      }),
    deleteVisit: (request: Request, id: string) =>
      handle(async () => {
        assertSameOrigin(request);
        const selected = await profile();
        const validId = parseInput(idSchema, id, "INVALID_ID");
        const deleted = await deps.repository().deleteVisit(validId, selected);
        await changed();
        return json({
          data: {
            id: deleted.id,
            restaurantId: deleted.restaurantId,
            deleted: true,
          },
        });
      }),
    externalSearch: (request: Request) =>
      handle(async () => {
        await profile();
        const query = parseQuery(externalSearchQuerySchema, request);
        const provider = deps.provider();
        if (!provider)
          return json({
            status: "unconfigured",
            provider: null,
            message:
              "External place search is not configured. Search saved places or create a manual entry.",
            data: [],
            pagination: pagination(query, 0),
          });
        try {
          const result = await provider.search(query.q, {
            page: query.page,
            pageSize: query.pageSize,
            signal: request.signal,
          });
          const response = externalSearchResponseSchema.parse({
            status: "configured",
            provider: provider.name,
            data: result.data,
            pagination: pagination(query, result.total),
          });
          return json(response);
        } catch (error) {
          deps.reportError(error);
          throw new ApiError(
            502,
            "PROVIDER_UNAVAILABLE",
            "External search is unavailable. Try saved places or manual entry.",
          );
        }
      }),
  };
}
