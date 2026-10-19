CREATE TABLE "restaurant_review_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"source_fingerprint" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_review_ids" jsonb NOT NULL,
	"claims" jsonb,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_at" timestamp with time zone,
	CONSTRAINT "restaurant_review_summary_fingerprint" CHECK ("restaurant_review_summaries"."source_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "restaurant_review_summary_model_prompt" CHECK (length(trim("restaurant_review_summaries"."model")) > 0 and length(trim("restaurant_review_summaries"."prompt_version")) > 0),
	CONSTRAINT "restaurant_review_summary_status_value" CHECK ("restaurant_review_summaries"."status" in ('pending', 'completed', 'failed')),
	CONSTRAINT "restaurant_review_summary_completion" CHECK (("restaurant_review_summaries"."status" = 'completed') = ("restaurant_review_summaries"."claims" is not null and "restaurant_review_summaries"."generated_at" is not null)),
	CONSTRAINT "restaurant_review_summary_sources" CHECK (jsonb_typeof("restaurant_review_summaries"."source_review_ids") = 'array' and jsonb_array_length("restaurant_review_summaries"."source_review_ids") between 3 and 30),
	CONSTRAINT "restaurant_review_summary_attempts" CHECK ("restaurant_review_summaries"."attempts" > 0)
);
--> statement-breakpoint
ALTER TABLE "restaurant_review_summaries" ADD CONSTRAINT "restaurant_review_summaries_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_review_summary_cache_key" ON "restaurant_review_summaries" USING btree ("restaurant_id","source_fingerprint","model","prompt_version");--> statement-breakpoint
CREATE INDEX "restaurant_review_summary_status" ON "restaurant_review_summaries" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE FUNCTION invalidate_restaurant_review_summary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM restaurant_review_summaries WHERE restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    DELETE FROM restaurant_review_summaries WHERE restaurant_id = NEW.restaurant_id;
    RETURN NEW;
  ELSE
    DELETE FROM restaurant_review_summaries
      WHERE restaurant_id = OLD.restaurant_id OR restaurant_id = NEW.restaurant_id;
    RETURN NEW;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invalidate_summary_after_visit_insert
AFTER INSERT ON visits
FOR EACH ROW WHEN (NEW.review_text IS NOT NULL AND btrim(NEW.review_text) <> '')
EXECUTE FUNCTION invalidate_restaurant_review_summary();
--> statement-breakpoint
CREATE TRIGGER invalidate_summary_after_visit_delete
AFTER DELETE ON visits
FOR EACH ROW WHEN (OLD.review_text IS NOT NULL AND btrim(OLD.review_text) <> '')
EXECUTE FUNCTION invalidate_restaurant_review_summary();
--> statement-breakpoint
CREATE TRIGGER invalidate_summary_after_visit_source_update
AFTER UPDATE OF restaurant_id, profile_id, visit_date, review_text ON visits
FOR EACH ROW WHEN (
  OLD.review_text IS DISTINCT FROM NEW.review_text OR
  (OLD.review_text IS NOT NULL AND btrim(OLD.review_text) <> '' AND
    (OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id OR
     OLD.profile_id IS DISTINCT FROM NEW.profile_id OR
     OLD.visit_date IS DISTINCT FROM NEW.visit_date)) OR
  (NEW.review_text IS NOT NULL AND btrim(NEW.review_text) <> '' AND
    (OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id OR
     OLD.profile_id IS DISTINCT FROM NEW.profile_id OR
     OLD.visit_date IS DISTINCT FROM NEW.visit_date))
)
EXECUTE FUNCTION invalidate_restaurant_review_summary();
