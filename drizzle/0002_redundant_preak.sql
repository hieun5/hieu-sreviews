CREATE TABLE "recommendation_attendees" (
	"run_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	CONSTRAINT "recommendation_attendees_run_id_profile_id_pk" PRIMARY KEY("run_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"run_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	"result_id" uuid NOT NULL,
	"choice" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_feedback_run_id_profile_id_pk" PRIMARY KEY("run_id","profile_id"),
	CONSTRAINT "recommendation_feedback_choice" CHECK ("recommendation_feedback"."choice" in ('selected', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "recommendation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"restaurant_id" uuid,
	"provider" text,
	"provider_place_id" text,
	"provider_policy_version" text,
	"preference_score" numeric(9, 6) NOT NULL,
	"metrics" jsonb NOT NULL,
	"explanations" jsonb NOT NULL,
	CONSTRAINT "recommendation_rank" CHECK ("recommendation_results"."rank" between 1 and 20),
	CONSTRAINT "recommendation_preference_score" CHECK ("recommendation_results"."preference_score" between 0 and 100),
	CONSTRAINT "recommendation_result_identity" CHECK (("recommendation_results"."restaurant_id" is not null and "recommendation_results"."provider" is null and "recommendation_results"."provider_place_id" is null and "recommendation_results"."provider_policy_version" is null) or ("recommendation_results"."restaurant_id" is null and length(trim("recommendation_results"."provider")) > 0 and length(trim("recommendation_results"."provider_place_id")) > 0 and length(trim("recommendation_results"."provider_policy_version")) > 0)),
	CONSTRAINT "recommendation_result_metrics" CHECK (jsonb_typeof("recommendation_results"."metrics") = 'object' and jsonb_typeof("recommendation_results"."explanations") = 'array')
);
--> statement-breakpoint
CREATE TABLE "recommendation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"algorithm_version" text NOT NULL,
	"filters" jsonb NOT NULL,
	"search_query" text DEFAULT '' NOT NULL,
	"result_limit" integer NOT NULL,
	"counts" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "recommendation_mode" CHECK ("recommendation_runs"."mode" in ('favorites', 'new')),
	CONSTRAINT "recommendation_status" CHECK ("recommendation_runs"."status" in ('pending','completed','empty','unavailable','failed')),
	CONSTRAINT "recommendation_limit" CHECK ("recommendation_runs"."result_limit" between 1 and 20),
	CONSTRAINT "recommendation_request_hash" CHECK ("recommendation_runs"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "recommendation_filters_object" CHECK (jsonb_typeof("recommendation_runs"."filters") = 'object'),
	CONSTRAINT "recommendation_completion" CHECK (("recommendation_runs"."status" = 'pending') = ("recommendation_runs"."completed_at" is null)),
	CONSTRAINT "recommendation_failure_reason" CHECK ("recommendation_runs"."status" not in ('unavailable','failed') or length(trim("recommendation_runs"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "recommendation_visit_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	"result_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_link_identity" ON "recommendation_feedback" USING btree ("run_id","profile_id","result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_result_parent" ON "recommendation_results" USING btree ("run_id","id");--> statement-breakpoint
ALTER TABLE "recommendation_attendees" ADD CONSTRAINT "recommendation_attendees_run_id_recommendation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recommendation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_attendees" ADD CONSTRAINT "recommendation_attendees_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_run_id_profile_id_recommendation_attendees_run_id_profile_id_fk" FOREIGN KEY ("run_id","profile_id") REFERENCES "public"."recommendation_attendees"("run_id","profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_run_id_result_id_recommendation_results_run_id_id_fk" FOREIGN KEY ("run_id","result_id") REFERENCES "public"."recommendation_results"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_run_id_recommendation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."recommendation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" ADD CONSTRAINT "recommendation_visit_links_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" ADD CONSTRAINT "recommendation_visit_links_run_id_profile_id_result_id_recommendation_feedback_run_id_profile_id_result_id_fk" FOREIGN KEY ("run_id","profile_id","result_id") REFERENCES "public"."recommendation_feedback"("run_id","profile_id","result_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_result_rank" ON "recommendation_results" USING btree ("run_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_result_restaurant" ON "recommendation_results" USING btree ("run_id","restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_result_provider" ON "recommendation_results" USING btree ("run_id","provider","provider_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_request_identity" ON "recommendation_runs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "recommendation_runs_history" ON "recommendation_runs" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_visit_origin" ON "recommendation_visit_links" USING btree ("visit_id");
