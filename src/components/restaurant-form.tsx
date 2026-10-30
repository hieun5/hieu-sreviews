"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { visitResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";
import { usdToCents } from "@/lib/client/money";
import type { FormState } from "@/lib/action-state";
import { RatingPicker } from "./rating-picker";

export function RestaurantForm({
  profileName,
  today,
}: {
  profileName: string;
  today: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);
  const [priceTier, setPriceTier] = useState<number | null>(null);
  const error = (key: string) => state.fields?.[key]?.[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({});
    const form = new FormData(event.currentTarget);
    let amountSpentCents: number | null;
    try {
      amountSpentCents = usdToCents(String(form.get("amountSpent") ?? ""));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Enter a valid USD amount.";
      setState({
        error: message,
        fields: { "visit.amountSpentCents": [message] },
      });
      setPending(false);
      return;
    }

    try {
      const response = await requestJson(
        "/api/places/with-visit",
        {
          method: "POST",
          body: JSON.stringify({
            place: {
              name: String(form.get("name") ?? ""),
              address: "",
              kind: String(form.get("kind") ?? "restaurant"),
              cuisines: String(form.get("cuisines") ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              priceTier,
              confirmDuplicate: form.has("duplicateConfirmed"),
            },
            visit: {
              rating: Number(form.get("rating")),
              visitDate: String(form.get("visitDate") ?? ""),
              reviewText: String(form.get("reviewText") ?? ""),
              orderDescription: String(form.get("orderDescription") ?? ""),
              amountSpentCents,
            },
          }),
        },
        (value) => visitResponseSchema.parse(value),
      );
      router.push(`/places/${response.data.restaurantId}?saved=visit`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const fields = { ...caught.body.fieldErrors };
        if (fields["visit.amountSpentCents"])
          fields.amountSpent = fields["visit.amountSpentCents"];
        setState({
          error: caught.message,
          fields,
          duplicates: caught.body.details?.duplicates,
        });
      } else {
        setState({
          error:
            "Couldn’t save this place and visit. Check your connection and try again.",
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel journal-form space-y-6 p-4 sm:p-8">
      {state.error ? (
        <div role="alert" className="notice notice-error">
          {state.error}
        </div>
      ) : null}
      {state.duplicates?.length ? (
        <div className="rounded-lg border border-[#d9c5aa] bg-[#f7efdf] p-4">
          <p className="mb-3 text-sm font-semibold">Possible duplicates</p>
          {state.duplicates.map((place) => (
            <Link
              key={place.id}
              href={`/places/${place.id}`}
              className="mb-3 flex items-start justify-between gap-3 text-sm text-accent underline"
            >
              <span>
                {place.name}
                {place.address ? (
                  <span className="muted block text-xs">{place.address}</span>
                ) : null}
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
          <label className="flex items-start gap-3 text-xs">
            <input
              name="duplicateConfirmed"
              type="checkbox"
              className="mt-1 size-4 accent-[#a84625]"
            />
            I checked these matches. This is a different place.
          </label>
        </div>
      ) : null}

      <section className="space-y-6">
        <h2 className="section-title">The place</h2>
        <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="name" className="field-label">
              Place name <span className="text-accent">*</span>
            </label>
            <input
              id="name"
              name="name"
              className="input"
              placeholder="Restaurant or café name"
              required
              maxLength={160}
              defaultValue={state.values?.name}
              aria-invalid={!!error("place.name")}
            />
            {error("place.name") ? (
              <p className="field-error">{error("place.name")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="kind" className="field-label">
              Type <span className="text-accent">*</span>
            </label>
            <select
              id="kind"
              name="kind"
              className="input"
              defaultValue={state.values?.kind || "restaurant"}
            >
              <option value="restaurant">Restaurant</option>
              <option value="cafe">Café</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="cuisines" className="field-label">
            Cuisines & categories{" "}
            <span className="font-normal text-muted">· optional</span>
          </label>
          <input
            id="cuisines"
            name="cuisines"
            className="input"
            placeholder="e.g. Vietnamese, coffee, brunch"
            maxLength={500}
            defaultValue={state.values?.cuisines}
            aria-invalid={!!error("place.cuisines")}
            aria-describedby="cuisines-help"
          />
          <p id="cuisines-help" className="muted mb-0 mt-2 text-xs">
            Separate categories with commas. Up to eight categories.
          </p>
          {error("place.cuisines") ? (
            <p className="field-error">{error("place.cuisines")}</p>
          ) : null}
        </div>
        <div>
          <p className="field-label">
            Listed price tier{" "}
            <span className="font-normal text-muted">· optional</span>
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Listed price tier"
          >
            {[null, 1, 2, 3, 4].map((tier) => {
              const selected = priceTier === tier;
              return (
                <button
                  key={tier ?? "unknown"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPriceTier(tier)}
                  className={`btn ${selected ? "" : "btn-secondary"}`}
                >
                  {tier === null ? "Unknown" : "$".repeat(tier)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-line pt-6">
        <div>
          <h2 className="section-title mb-2">Your visit</h2>
          <p className="muted mb-0 text-sm">
            Reviewing as{" "}
            <strong className="font-semibold text-ink">{profileName}</strong>.
          </p>
        </div>
        <RatingPicker
          initialValue={state.values?.rating ?? ""}
          error={error("visit.rating")}
        />
        <div className="max-w-xs">
          <label htmlFor="visitDate" className="field-label">
            Visit date <span className="text-accent">*</span>
          </label>
          <input
            id="visitDate"
            name="visitDate"
            className="input"
            type="date"
            required
            max={today}
            defaultValue={state.values?.visitDate ?? today}
            aria-invalid={!!error("visit.visitDate")}
          />
          {error("visit.visitDate") ? (
            <p className="field-error">{error("visit.visitDate")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="orderDescription" className="field-label">
            What did you order?{" "}
            <span className="font-normal text-muted">· optional</span>
          </label>
          <textarea
            id="orderDescription"
            name="orderDescription"
            className="input"
            rows={2}
            maxLength={300}
            placeholder="What you had"
            defaultValue={state.values?.orderDescription}
            aria-invalid={!!error("visit.orderDescription")}
          />
          {error("visit.orderDescription") ? (
            <p className="field-error">{error("visit.orderDescription")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="reviewText" className="field-label">
            Review <span className="font-normal text-muted">· optional</span>
          </label>
          <textarea
            id="reviewText"
            name="reviewText"
            className="input"
            rows={4}
            maxLength={2000}
            placeholder="What did you think?"
            defaultValue={state.values?.reviewText}
            aria-invalid={!!error("visit.reviewText")}
          />
          {error("visit.reviewText") ? (
            <p className="field-error">{error("visit.reviewText")}</p>
          ) : null}
        </div>
        <div className="max-w-xs">
          <label htmlFor="amountSpent" className="field-label">
            Spent per person{" "}
            <span className="font-normal text-muted">· optional</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-2.5 text-sm text-muted">
              $
            </span>
            <input
              id="amountSpent"
              name="amountSpent"
              className="input pl-8 pr-14"
              type="number"
              inputMode="decimal"
              min="0"
              max="9999999999.99"
              step="0.01"
              placeholder="Not recorded"
              defaultValue={state.values?.amountSpent}
              aria-invalid={!!error("visit.amountSpentCents")}
            />
            <span className="absolute right-4 top-3 text-xs text-muted">
              USD
            </span>
          </div>
          {error("visit.amountSpentCents") ? (
            <p className="field-error">{error("visit.amountSpentCents")}</p>
          ) : null}
        </div>
      </section>

      <div className="form-actions flex flex-wrap gap-3 border-t border-line pt-6">
        <button className="btn" disabled={pending}>
          {pending ? "Saving place and visit…" : "Save place and visit"}
        </button>
        <Link href="/places" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
