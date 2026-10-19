CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"avatar" text NOT NULL,
	CONSTRAINT "profile_name_nonempty" CHECK (length(trim("profiles"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"kind" text DEFAULT 'restaurant' NOT NULL,
	"cuisines" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_tier" integer,
	"normalized_name" text NOT NULL,
	"normalized_address" text NOT NULL,
	"provider" text,
	"provider_place_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_name_length" CHECK (length(trim("restaurants"."name")) between 1 and 160),
	CONSTRAINT "restaurant_address_length" CHECK (length(trim("restaurants"."address")) between 1 and 300),
	CONSTRAINT "restaurant_kind" CHECK ("restaurants"."kind" in ('restaurant', 'cafe')),
	CONSTRAINT "restaurant_price_tier" CHECK ("restaurants"."price_tier" between 1 and 4),
	CONSTRAINT "restaurant_provider_pair" CHECK (("restaurants"."provider" is null) = ("restaurants"."provider_place_id" is null))
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	"rating" numeric NOT NULL,
	"visit_date" date NOT NULL,
	"review_text" text,
	"order_description" text,
	"amount_spent" numeric(12, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_rating_range" CHECK ("visits"."rating" >= 1 and "visits"."rating" <= 10),
	CONSTRAINT "visit_review_length" CHECK (char_length("visits"."review_text") <= 2000),
	CONSTRAINT "visit_order_length" CHECK (char_length("visits"."order_description") <= 300),
	CONSTRAINT "visit_spending_nonnegative" CHECK ("visits"."amount_spent" >= 0),
	CONSTRAINT "visit_currency" CHECK ("visits"."currency" = 'USD'),
	CONSTRAINT "visit_not_future_utc" CHECK ("visits"."visit_date" <= (now() at time zone 'UTC')::date)
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_provider_identity" ON "restaurants" USING btree ("provider","provider_place_id");--> statement-breakpoint
CREATE INDEX "restaurant_manual_duplicate_lookup" ON "restaurants" USING btree ("normalized_name","normalized_address");--> statement-breakpoint
CREATE INDEX "restaurant_cuisines" ON "restaurants" USING gin ("cuisines");--> statement-breakpoint
CREATE INDEX "visit_current_rating_lookup" ON "visits" USING btree ("restaurant_id","profile_id","visit_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "visit_profile_history" ON "visits" USING btree ("profile_id","visit_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "visit_date_lookup" ON "visits" USING btree ("visit_date" DESC NULLS LAST);