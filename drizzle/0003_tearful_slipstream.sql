ALTER TABLE "recommendation_results" DROP CONSTRAINT "recommendation_result_identity";--> statement-breakpoint
ALTER TABLE "recommendation_runs" DROP CONSTRAINT "recommendation_failure_reason";--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" DROP CONSTRAINT "recommendation_visit_links_run_id_profile_id_result_id_recommendation_feedback_run_id_profile_id_result_id_fk";
--> statement-breakpoint
DROP INDEX "recommendation_feedback_link_identity";--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" ADD COLUMN "feedback_choice" text DEFAULT 'selected' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_link_identity" ON "recommendation_feedback" USING btree ("run_id","profile_id","result_id","choice");--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" ADD CONSTRAINT "recommendation_link_feedback_fk" FOREIGN KEY ("run_id","profile_id","result_id","feedback_choice") REFERENCES "public"."recommendation_feedback"("run_id","profile_id","result_id","choice") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_result_identity" CHECK (("recommendation_results"."restaurant_id" is not null and "recommendation_results"."provider" is null and "recommendation_results"."provider_place_id" is null and "recommendation_results"."provider_policy_version" is null) or ("recommendation_results"."restaurant_id" is null and "recommendation_results"."provider" is not null and "recommendation_results"."provider_place_id" is not null and "recommendation_results"."provider_policy_version" is not null and length(trim("recommendation_results"."provider")) > 0 and length(trim("recommendation_results"."provider_place_id")) > 0 and length(trim("recommendation_results"."provider_policy_version")) > 0));--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_failure_reason" CHECK ("recommendation_runs"."status" not in ('unavailable','failed') or ("recommendation_runs"."reason" is not null and length(trim("recommendation_runs"."reason")) > 0));--> statement-breakpoint
ALTER TABLE "recommendation_visit_links" ADD CONSTRAINT "recommendation_confirmed_selection" CHECK ("recommendation_visit_links"."feedback_choice" = 'selected');
--> statement-breakpoint
CREATE FUNCTION invalidate_recommendation_visit_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    OR NEW.visit_date IS DISTINCT FROM OLD.visit_date THEN
    DELETE FROM recommendation_visit_links WHERE visit_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER recommendation_visit_identity_changed
AFTER UPDATE OF restaurant_id, profile_id, visit_date ON visits
FOR EACH ROW EXECUTE FUNCTION invalidate_recommendation_visit_link();
