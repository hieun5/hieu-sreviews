import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { PROFILE_COOKIE } from "@/lib/profile";
import { ApiError } from "./api-errors";
import { createJournalApi } from "./journal-api";
import { createJournalRepository } from "./journal-repository";
import { getPlaceProvider } from "./place-provider";
import { createReportingApi } from "./reporting-api";
import { createReportingRepository } from "./reporting-repository";
import { createRecommendationApi } from "./recommendation-api";
import { createRecommendationRepository } from "./recommendation-repository";
import { createRecommendationClient } from "./recommendation-client";
import { getRecommendationProvider } from "./recommendation-provider";
import { createReviewSummaryApi } from "./review-summary-api";
import { createReviewSummaryRepository } from "./review-summary-repository";
import { getReviewSummaryModelAdapter } from "./review-summary-model";

function database() {
  if (!process.env.DATABASE_URL)
    throw new ApiError(
      503,
      "DATABASE_UNCONFIGURED",
      "The journal database has not been connected yet.",
    );
  return getDb();
}

const selectedProfile = async () =>
  (await cookies()).get(PROFILE_COOKIE)?.value;
const timeZone = () => process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE;
const today = () => todayInTimeZone(new Date(), timeZone());
// Avoid logging request bodies, SQL parameters or connection strings.
const reportError = (error: unknown) =>
  console.error("Journal API operation failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });

export const journalApi = createJournalApi({
  repository: () => createJournalRepository(database()),
  selectedProfile,
  today,
  provider: getPlaceProvider,
  onMutation: () => revalidatePath("/", "layout"),
  reportError,
});

export const reportingApi = createReportingApi({
  repository: () => createReportingRepository(database()),
  selectedProfile,
  today,
  timeZone,
  reportError,
});

export const recommendationApi = createRecommendationApi({
  repository: () => createRecommendationRepository(database()),
  selectedProfile,
  timeZone,
  reportError,
  provider: getRecommendationProvider,
  scorer: () =>
    createRecommendationClient({
      url: process.env.RECOMMENDER_URL,
      secret: process.env.RECOMMENDER_SHARED_SECRET,
    }),
});

export const reviewSummaryApi = createReviewSummaryApi({
  repository: () => createReviewSummaryRepository(database()),
  selectedProfile,
  model: getReviewSummaryModelAdapter,
  reportError,
});
