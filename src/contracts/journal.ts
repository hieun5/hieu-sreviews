import { z } from "zod";
import { friendProfiles } from "@/config/profiles";

export const profileIdSchema = z.enum(
  friendProfiles.map((profile) => profile.id),
);
export const idSchema = z.uuid().transform((value) => value.toLowerCase());
export const calendarDateSchema = z.iso
  .date()
  .refine(
    (value) => !value.startsWith("0000"),
    "Use a calendar year from 0001 through 9999.",
  );
export const MAX_SPENDING_CENTS = 999_999_999_999;
export const moneyCentsSchema = z.number().int().min(0).max(MAX_SPENDING_CENTS);
export const ratingSchema = z.number().min(1).max(10);

const paginationFields = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});

export const restaurantListQuerySchema = z.strictObject({
  ...paginationFields,
  q: z.string().trim().max(300).default(""),
  kind: z.enum(["restaurant", "cafe"]).optional(),
  cuisine: z.string().trim().min(1).max(60).optional(),
});

export const restaurantCreateSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/[\p{L}\p{N}]/u, "Use letters or numbers."),
    address: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .regex(/[\p{L}\p{N}]/u, "Use letters or numbers."),
    kind: z.enum(["restaurant", "cafe"]).default("restaurant"),
    cuisines: z
      .array(z.string().trim().min(1).max(60))
      .max(8)
      .default([])
      .transform((items) => [...new Set(items)]),
    priceTier: z.number().int().min(1).max(4).nullable().default(null),
    provider: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .toLowerCase()
      .nullable()
      .default(null),
    providerPlaceId: z.string().trim().min(1).max(300).nullable().default(null),
    confirmDuplicate: z.boolean().default(false),
  })
  .refine(
    (value) => (value.provider === null) === (value.providerPlaceId === null),
    {
      message: "Supply both provider and providerPlaceId, or neither.",
      path: ["providerPlaceId"],
    },
  );

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null)
    .nullable();

function visitFields(today: string) {
  return {
    rating: ratingSchema,
    visitDate: calendarDateSchema.refine(
      (value) => value <= today,
      "Visit date cannot be in the future.",
    ),
    reviewText: optionalText(2000),
    orderDescription: optionalText(300),
    amountSpentCents: moneyCentsSchema.nullable(),
  };
}

// No fixed increment: every finite JSON number in [1, 10] is allowed.
export function visitCreateSchema(today: string) {
  const fields = visitFields(today);
  return z.strictObject({
    restaurantId: idSchema,
    ...fields,
    reviewText: fields.reviewText.default(null),
    orderDescription: fields.orderDescription.default(null),
    amountSpentCents: fields.amountSpentCents.default(null),
  });
}

export function visitUpdateSchema(today: string) {
  // Creation defaults must not populate PATCH: omission preserves stored data.
  return z
    .strictObject(visitFields(today))
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Supply at least one visit field.",
    );
}

export const visitListQuerySchema = z
  .strictObject({
    ...paginationFields,
    restaurantId: idSchema.optional(),
    profileId: profileIdSchema.optional(),
    start: calendarDateSchema.optional(),
    end: calendarDateSchema.optional(),
  })
  .refine((value) => !value.start || !value.end || value.start <= value.end, {
    message: "Start date must be on or before end date.",
    path: ["end"],
  });

export const externalSearchQuerySchema = z.strictObject({
  ...paginationFields,
  q: z.string().trim().min(1).max(300),
});

const timestampSchema = z.iso.datetime({ offset: true });
export const restaurantSchema = z.object({
  id: idSchema,
  name: z.string(),
  address: z.string(),
  kind: z.enum(["restaurant", "cafe"]),
  cuisines: z.array(z.string()),
  priceTier: z.number().int().min(1).max(4).nullable(),
  provider: z.string().nullable(),
  providerPlaceId: z.string().nullable(),
  createdAt: timestampSchema,
});
export const visitSchema = z.object({
  id: idSchema,
  restaurantId: idSchema,
  profileId: z.string().min(1),
  rating: ratingSchema,
  visitDate: calendarDateSchema,
  reviewText: z.string().nullable(),
  orderDescription: z.string().nullable(),
  amountSpentCents: moneyCentsSchema.nullable(),
  currency: z.literal("USD"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// Decimal strings keep aggregates exact until the UI chooses display precision.
export const currentRatingSummarySchema = z.object({
  average: z.string().nullable(),
  agreement: z.string().nullable(),
  reviewerCount: z.number().int().nonnegative(),
  visitCount: z.number().int().nonnegative(),
  scores: z.array(
    z.object({
      profileId: z.string().min(1),
      visitId: idSchema,
      rating: ratingSchema,
      visitDate: calendarDateSchema,
    }),
  ),
});
export const restaurantWithSummarySchema = restaurantSchema.extend({
  currentRating: currentRatingSummarySchema,
});
export const restaurantListResponseSchema = z.object({
  data: z.array(restaurantWithSummarySchema),
  pagination: paginationSchema,
});
export const restaurantResponseSchema = z.object({
  data: restaurantWithSummarySchema,
});
export const visitListResponseSchema = z.object({
  data: z.array(visitSchema),
  pagination: paginationSchema,
});
export const visitResponseSchema = z.object({ data: visitSchema });
export const visitDeleteResponseSchema = z.object({
  data: z.object({
    id: idSchema,
    restaurantId: idSchema,
    deleted: z.literal(true),
  }),
});

export const apiErrorCodes = [
  "INVALID_QUERY",
  "INVALID_ID",
  "INVALID_JSON",
  "VALIDATION_ERROR",
  "UNSUPPORTED_MEDIA_TYPE",
  "PAYLOAD_TOO_LARGE",
  "PROFILE_REQUIRED",
  "PROFILE_UNAVAILABLE",
  "PROFILE_MISMATCH",
  "FORBIDDEN_ORIGIN",
  "NOT_FOUND",
  "POSSIBLE_DUPLICATE",
  "PROVIDER_ID_CONFLICT",
  "DATABASE_UNCONFIGURED",
  "DATABASE_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL_ERROR",
  "METHOD_NOT_ALLOWED",
  "RECOMMENDER_UNCONFIGURED",
  "RECOMMENDER_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "FEEDBACK_LOCKED",
  "INVALID_VISIT_LINK",
  "NOT_ATTENDING",
  "SUMMARY_MODEL_UNCONFIGURED",
  "SUMMARY_MODEL_UNAVAILABLE",
  "SUMMARY_SOURCE_CHANGED",
  "SUMMARY_INVALID_OUTPUT",
  "SUMMARY_MODEL_TIMEOUT",
] as const;
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())),
    details: z
      .object({
        runId: idSchema.optional(),
        duplicates: z
          .array(restaurantSchema.pick({ id: true, name: true, address: true }))
          .optional(),
      })
      .optional(),
  }),
});

export const externalPlaceSchema = z.object({
  provider: z.string(),
  providerPlaceId: z.string(),
  name: z.string(),
  address: z.string(),
  categories: z.array(z.string()),
  priceTier: z.number().int().min(1).max(4).optional(),
  attribution: z.object({ text: z.string(), url: z.url().optional() }),
});
export const externalSearchResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unconfigured"),
    provider: z.null(),
    message: z.string(),
    data: z.array(externalPlaceSchema).length(0),
    pagination: paginationSchema,
  }),
  z.object({
    status: z.literal("configured"),
    provider: z.string(),
    data: z.array(externalPlaceSchema),
    pagination: paginationSchema,
  }),
]);

export type RestaurantCreate = z.infer<typeof restaurantCreateSchema>;
export type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>;
export type VisitCreate = z.infer<ReturnType<typeof visitCreateSchema>>;
export type VisitUpdate = z.infer<ReturnType<typeof visitUpdateSchema>>;
export type VisitListQuery = z.infer<typeof visitListQuerySchema>;
export type Restaurant = z.infer<typeof restaurantWithSummarySchema>;
export type Visit = z.infer<typeof visitSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = ApiErrorBody["error"]["code"];
export type ExternalPlace = z.infer<typeof externalPlaceSchema>;
