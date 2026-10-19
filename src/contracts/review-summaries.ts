import { z } from "zod";
import { idSchema } from "./journal";

export const REVIEW_SUMMARY_PROMPT_VERSION = "review-summary-v1";

export const reviewSummaryClaimsSchema = z
  .strictObject({
    claims: z
      .array(
        z.strictObject({
          text: z.string().trim().min(1).max(240),
          supportingReviewIds: z.array(idSchema).min(1).max(30),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine(
    ({ claims }) =>
      claims.every(
        (claim) =>
          new Set(claim.supportingReviewIds).size ===
          claim.supportingReviewIds.length,
      ),
    { path: ["claims"], message: "Review citations must be unique per claim." },
  );

export const reviewSummaryResponseSchema = z.object({
  data: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("ready"),
      restaurantId: idSchema,
      sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      model: z.string().min(1),
      promptVersion: z.string().min(1),
      sourceReviewCount: z.number().int().min(3).max(30),
      profileCount: z.number().int().min(2),
      sourceReviewIds: z.array(idSchema).min(3).max(30),
      claims: reviewSummaryClaimsSchema.shape.claims,
      generatedAt: z.iso.datetime({ offset: true }),
      cached: z.boolean(),
    }),
    z.object({
      status: z.literal("insufficient-reviews"),
      restaurantId: idSchema,
      sourceReviewCount: z.number().int().nonnegative().max(30),
      profileCount: z.number().int().nonnegative(),
      requiredReviewCount: z.literal(3),
      requiredProfileCount: z.literal(2),
    }),
    z.object({
      status: z.literal("generating"),
      restaurantId: idSchema,
      retryAfterSeconds: z.literal(2),
    }),
  ]),
});

export type ReviewSummaryResponse = z.infer<typeof reviewSummaryResponseSchema>;

export type ReviewSummaryClaims = z.infer<typeof reviewSummaryClaimsSchema>;
