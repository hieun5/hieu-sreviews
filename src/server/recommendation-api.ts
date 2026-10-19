import {
  confirmedVisitSchema,
  discoveryCandidateSchema,
  recommendationCreateSchema,
  recommendationListQuerySchema,
  recommendationResponseSchema,
  resultDisplaySchema,
  selectionFeedbackSchema,
  recommendationListResponseSchema,
  recommendationProjectionSchemas,
  type DiscoveryCandidate,
  type RecommendationCreate,
  type ScoringCandidate,
  type ScoringInput,
} from "@/contracts/recommendations";
import { idSchema, profileIdSchema } from "@/contracts/journal";
import { currentRatings } from "@/lib/ratings";
import { normalizePlace } from "@/lib/validation";
import { todayInTimeZone } from "@/lib/dates";
import {
  ApiError,
  assertSameOrigin,
  handleApi,
  json,
  parseInput,
  parseJson,
  parseQuery,
} from "./api-errors";
import { isoTimestamp, serializeRestaurant } from "./journal-serialization";
import type { RecommendationClient } from "./recommendation-client";
import type { RecommendationProvider } from "./recommendation-provider";
import type {
  RecommendationRepository,
  PersistedRanking,
} from "./recommendation-repository";

type Dependencies = {
  repository: () => RecommendationRepository;
  selectedProfile: () => Promise<string | undefined>;
  scorer: () => RecommendationClient;
  provider: () => RecommendationProvider | null;
  timeZone: () => string;
  reportError: (error: unknown) => void;
};
const normalizedKey = (name: string, address: string) =>
  JSON.stringify([normalizePlace(name), normalizePlace(address)]);
const providerKey = (provider: string, id: string) =>
  JSON.stringify([provider.trim().toLowerCase(), id]);

function permitted(provider: RecommendationProvider) {
  const policy = provider.retention;
  try {
    return (
      policy.permanentIdentifiers === true &&
      policy.derivedPreferenceScores === true &&
      policy.version.trim().length > 0 &&
      new URL(policy.termsUrl).protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function createRecommendationApi(deps: Dependencies) {
  async function selected() {
    const profile = profileIdSchema.safeParse(await deps.selectedProfile());
    if (!profile.success)
      throw new ApiError(
        401,
        "PROFILE_REQUIRED",
        "Select a predefined journal profile first.",
      );
    return profile.data;
  }
  const handle = (work: () => Promise<Response>) =>
    handleApi(work, deps.reportError);

  async function readRun(
    repository: RecommendationRepository,
    id: string,
    ephemeral = new Map<string, DiscoveryCandidate>(),
  ) {
    const run = await repository.getRun(id);
    if (!run)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The recommendation run could not be found.",
      );
    const context = run.results.some((row) => row.restaurantId)
      ? await repository.context()
      : null;
    const places = new Map(
      context?.restaurants.map((row) => [row.id, row]) ?? [],
    );
    const provider = deps.provider();
    const ranked = await Promise.all(
      run.results.map(async ({ providerPolicyVersion, ...row }) => {
        let display;
        if (row.restaurantId) {
          const place = places.get(row.restaurantId);
          display = place
            ? {
                status: "available",
                source: "journal",
                restaurant: serializeRestaurant(place, context?.visits ?? []),
              }
            : {
                status: "unavailable",
                reason: "This saved restaurant is no longer available.",
              };
        } else {
          let candidate =
            row.provider && row.providerPlaceId
              ? ephemeral.get(providerKey(row.provider, row.providerPlaceId))
              : undefined;
          if (
            !candidate &&
            provider &&
            permitted(provider) &&
            provider.retention.version === providerPolicyVersion &&
            row.provider === provider.name &&
            row.providerPlaceId
          ) {
            try {
              const refreshed = discoveryCandidateSchema.parse(
                await provider.getDetails(row.providerPlaceId),
              );
              if (
                refreshed.provider === row.provider &&
                refreshed.providerPlaceId === row.providerPlaceId
              )
                candidate = refreshed;
            } catch {
              /* An unavailable listing remains unavailable, never invented. */
            }
          }
          display = candidate
            ? { status: "available", source: "provider", candidate }
            : {
                status: "unavailable",
                reason:
                  "Provider details and attribution could not be refreshed. Listing data was not cached.",
              };
        }
        return { ...row, display: resultDisplaySchema.parse(display) };
      }),
    );
    return recommendationResponseSchema.parse({
      data: { ...run, results: ranked },
    });
  }

  async function discover(input: RecommendationCreate, signal: AbortSignal) {
    const provider = deps.provider();
    if (!provider)
      return {
        reason: "discovery-unconfigured",
        provider: null,
        candidates: [] as DiscoveryCandidate[],
      };
    if (!permitted(provider))
      return {
        reason: "provider-storage-policy-unavailable",
        provider: null,
        candidates: [] as DiscoveryCandidate[],
      };
    try {
      const response = await provider.discover({
        query: input.query,
        filters: input.filters,
        signal,
      });
      if (response.length > 1000)
        throw new Error("Too many provider candidates");
      const unique = new Map<string, DiscoveryCandidate>();
      for (const raw of response) {
        const candidate = discoveryCandidateSchema.parse(raw);
        candidate.cuisines = [...new Set(candidate.cuisines)].sort();
        if (
          candidate.provider !== provider.name ||
          !normalizePlace(candidate.name) ||
          !normalizePlace(candidate.address)
        )
          throw new Error("Invalid provider identity");
        const key = providerKey(candidate.provider, candidate.providerPlaceId);
        if (
          unique.has(key) &&
          JSON.stringify(unique.get(key)) !== JSON.stringify(candidate)
        )
          throw new Error("Conflicting provider identity");
        unique.set(key, candidate);
      }
      return { reason: null, provider, candidates: [...unique.values()] };
    } catch {
      throw new ApiError(
        502,
        "PROVIDER_UNAVAILABLE",
        "Live discovery failed. No saved or fake places were substituted.",
      );
    }
  }

  return {
    create: (request: Request) =>
      handle(async () => {
        assertSameOrigin(request);
        const creator = await selected();
        const input = parseInput(
          recommendationCreateSchema,
          await parseJson(request),
        );
        const repository = deps.repository();
        const context = await repository.context();
        const knownProfiles = new Set(context.profiles.map((row) => row.id));
        if (![creator, ...input.attendees].every((id) => knownProfiles.has(id)))
          throw new ApiError(
            409,
            "PROFILE_UNAVAILABLE",
            "Seed the selected profile and all attendees before starting a run.",
          );
        const claimed = await repository.claim(input, creator);
        if (!claimed.created) {
          const existing = await readRun(repository, claimed.id);
          return json(existing, existing.data.status === "pending" ? 202 : 200);
        }
        const ephemeral = new Map<string, DiscoveryCandidate>();
        try {
          let candidates: ScoringCandidate[];
          let policyVersion: string | null = null;
          if (input.mode === "new") {
            const discovered = await discover(input, request.signal);
            if (discovered.reason) {
              await repository.markState(
                claimed.id,
                "unavailable",
                discovered.reason,
              );
              return json(await readRun(repository, claimed.id), 201, {
                Location: `/api/recommendations/runs/${claimed.id}`,
              });
            }
            policyVersion = discovered.provider!.retention.version;
            candidates = discovered.candidates.map((candidate) => {
              const key = providerKey(
                candidate.provider,
                candidate.providerPlaceId,
              );
              ephemeral.set(key, candidate);
              return {
                key,
                restaurantId: null,
                provider: candidate.provider,
                providerPlaceId: candidate.providerPlaceId,
                normalizedKey: normalizedKey(candidate.name, candidate.address),
                kind: candidate.kind,
                cuisines: candidate.cuisines,
                priceTier: candidate.priceTier,
                distanceMeters: candidate.distanceMeters,
                openNow: candidate.openNow,
              };
            });
          } else {
            candidates = context.restaurants.map((place) => ({
              key: place.id,
              restaurantId: place.id,
              provider: null,
              providerPlaceId: null,
              normalizedKey: normalizedKey(place.name, place.address),
              kind: place.kind as "restaurant" | "cafe",
              cuisines: place.cuisines,
              priceTier: place.priceTier,
              distanceMeters: null,
              openNow: null,
            }));
          }
          const scorer = deps.scorer();
          if (!scorer.configured) {
            await repository.markState(
              claimed.id,
              "unavailable",
              "scorer-unconfigured",
            );
            return json(await readRun(repository, claimed.id), 201, {
              Location: `/api/recommendations/runs/${claimed.id}`,
            });
          }
          const loggedIds = new Set(
            context.visits.map((visit) => visit.restaurantId),
          );
          const logged = context.restaurants.filter((place) =>
            loggedIds.has(place.id),
          );
          const scoring: ScoringInput = {
            mode: input.mode,
            attendees: [...input.attendees].sort(),
            candidates,
            ratings: currentRatings(context.visits).map(
              ({ restaurantId, profileId, rating }) => ({
                restaurantId,
                profileId,
                rating: rating!,
              }),
            ),
            places: context.restaurants.map(({ id, cuisines }) => ({
              restaurantId: id,
              cuisines,
            })),
            // Favorites revisits recorded places; discovery excludes the entire
            // group's history, including nonattendees and older return visits.
            excluded:
              input.mode === "new"
                ? {
                    restaurantIds: [...loggedIds],
                    providerKeys: logged.flatMap((place) =>
                      place.provider && place.providerPlaceId
                        ? [providerKey(place.provider, place.providerPlaceId)]
                        : [],
                    ),
                    normalizedKeys: logged.map((place) =>
                      normalizedKey(place.name, place.address),
                    ),
                  }
                : { restaurantIds: [], providerKeys: [], normalizedKeys: [] },
            filters: input.filters,
            limit: input.limit,
          };
          if (
            new TextEncoder().encode(JSON.stringify(scoring)).length > 2_000_000
          )
            throw new ApiError(
              413,
              "PAYLOAD_TOO_LARGE",
              "This journal exceeds the scoring request limit; no data was silently truncated.",
            );
          const scored = await scorer.score(scoring);
          const byKey = new Map(
            candidates.map((candidate) => [candidate.key, candidate]),
          );
          const rankings: PersistedRanking[] = scored.results.map((row) => {
            const candidate = byKey.get(row.candidateKey);
            if (!candidate)
              throw new ApiError(
                502,
                "RECOMMENDER_UNAVAILABLE",
                "The recommendation service returned an unknown candidate.",
              );
            return {
              ...row,
              restaurantId: candidate.restaurantId,
              provider: candidate.provider,
              providerPlaceId: candidate.providerPlaceId,
              providerPolicyVersion: candidate.provider ? policyVersion : null,
            };
          });
          await repository.finish(claimed.id, scored, rankings);
        } catch (error) {
          await repository.markState(
            claimed.id,
            "failed",
            error instanceof ApiError ? error.code : "INTERNAL_ERROR",
          );
          if (error instanceof ApiError)
            throw new ApiError(
              error.status,
              error.code,
              error.message,
              error.fieldErrors,
              { runId: claimed.id },
            );
          throw error;
        }
        return json(await readRun(repository, claimed.id, ephemeral), 201, {
          Location: `/api/recommendations/runs/${claimed.id}`,
        });
      }),
    list: (request: Request) =>
      handle(async () => {
        await selected();
        const query = parseQuery(recommendationListQuerySchema, request);
        const result = await deps.repository().list(query.page, query.pageSize);
        return json(
          recommendationListResponseSchema.parse({
            ...result,
            data: result.data.map((row) => ({
              ...row,
              createdAt: isoTimestamp(row.createdAt),
            })),
          }),
        );
      }),
    get: (_request: Request, id: string) =>
      handle(async () => {
        await selected();
        return json(
          await readRun(
            deps.repository(),
            parseInput(idSchema, id, "INVALID_ID"),
          ),
        );
      }),
    projection: (
      _request: Request,
      id: string,
      section: "attendees" | "results" | "feedback" | "confirmedVisits",
    ) =>
      handle(async () => {
        await selected();
        const { data } = await readRun(
          deps.repository(),
          parseInput(idSchema, id, "INVALID_ID"),
        );
        return json(
          recommendationProjectionSchemas[section].parse({
            data: data[section],
            meta: {
              runId: data.id,
              status: data.status,
              scoreKind: data.scoreKind,
              scoreRange: data.scoreRange,
              algorithmVersion: data.algorithmVersion,
            },
          }),
        );
      }),
    feedback: (request: Request, id: string) =>
      handle(async () => {
        assertSameOrigin(request);
        const profile = await selected();
        const runId = parseInput(idSchema, id, "INVALID_ID");
        const input = parseInput(
          selectionFeedbackSchema,
          await parseJson(request),
        );
        const repository = deps.repository();
        await repository.feedback(runId, input.resultId, profile, input.choice);
        return json(await readRun(repository, runId));
      }),
    confirmVisit: (request: Request, id: string) =>
      handle(async () => {
        assertSameOrigin(request);
        const profile = await selected();
        const runId = parseInput(idSchema, id, "INVALID_ID");
        const input = parseInput(
          confirmedVisitSchema,
          await parseJson(request),
        );
        const repository = deps.repository();
        const run = await repository.getRun(runId);
        if (!run)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "The recommendation run could not be found.",
          );
        const earliest = todayInTimeZone(
          new Date(run.createdAt),
          deps.timeZone(),
        );
        await repository.confirmVisit(
          runId,
          input.resultId,
          profile,
          input.visitId,
          earliest,
        );
        return json(await readRun(repository, runId));
      }),
  };
}
