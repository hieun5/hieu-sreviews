import { profileIdSchema } from "@/contracts/journal";
import {
  analyticsQuerySchema,
  analyticsResponseSchema,
  dashboardQuerySchema,
  dashboardResponseSchema,
  reportSemantics,
  type EffectiveReportFilters,
  type ReportMeta,
} from "@/contracts/reporting";
import { ApiError, handleApi, json, parseQuery } from "./api-errors";
import type { ReportingRepository } from "./reporting-repository";

type Dependencies = {
  repository: () => ReportingRepository;
  selectedProfile: () => Promise<string | undefined>;
  today: () => string;
  timeZone: () => string;
  reportError: (error: unknown) => void;
};

export function createReportingApi(deps: Dependencies) {
  async function response(request: Request, mode: "analytics" | "dashboard") {
    return handleApi(async () => {
      const selected = profileIdSchema.safeParse(await deps.selectedProfile());
      if (!selected.success)
        throw new ApiError(
          401,
          "PROFILE_REQUIRED",
          "Select a predefined journal profile first.",
        );
      const query =
        mode === "dashboard"
          ? parseQuery(dashboardQuerySchema, request)
          : parseQuery(analyticsQuerySchema, request);
      const filters: EffectiveReportFilters = {
        view: query.view,
        profileId:
          query.view === "personal" ? (query.profileId ?? selected.data) : null,
        restaurantId: query.restaurantId ?? null,
        cuisine: query.cuisine ?? null,
        start: query.start ?? null,
        end: query.end ?? null,
      };
      const personalProfileId = filters.profileId ?? selected.data;
      const recentLimit =
        "recentLimit" in query && typeof query.recentLimit === "number"
          ? query.recentLimit
          : undefined;
      const data = await deps
        .repository()
        .report(mode, filters, personalProfileId, recentLimit, deps.timeZone());
      const meta: ReportMeta = {
        filters,
        selectedProfileId: selected.data,
        personalProfileId,
        today: deps.today(),
        timeZone: deps.timeZone(),
        semantics: reportSemantics,
      };
      const body = { data: { ...data, meta } };
      // Validate the complete boundary, including effective filters and labels.
      return json(
        mode === "dashboard"
          ? dashboardResponseSchema.parse(body)
          : analyticsResponseSchema.parse(body),
      );
    }, deps.reportError);
  }
  return {
    dashboard: (request: Request) => response(request, "dashboard"),
    analytics: (request: Request) => response(request, "analytics"),
  };
}
