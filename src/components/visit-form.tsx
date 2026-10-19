"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { visitResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";
import { usdToCents } from "@/lib/client/money";
import type { Visit } from "@/db/schema";
import type { FormState } from "@/lib/action-state";
import { RatingPicker } from "./rating-picker";

export function VisitForm({
  restaurantId,
  profileName,
  today,
  visit,
}: {
  restaurantId: string;
  profileName: string;
  today: string;
  visit?: Visit;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);
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
      setState({
        error:
          caught instanceof Error
            ? caught.message
            : "Enter a valid USD amount.",
        fields: {
          amountSpent: [
            caught instanceof Error
              ? caught.message
              : "Enter a valid USD amount.",
          ],
        },
      });
      setPending(false);
      return;
    }
    const body = {
      ...(visit ? {} : { restaurantId }),
      rating: Number(form.get("rating")),
      visitDate: String(form.get("visitDate") ?? ""),
      reviewText: String(form.get("reviewText") ?? ""),
      orderDescription: String(form.get("orderDescription") ?? ""),
      amountSpentCents,
    };
    try {
      const response = await requestJson(
        visit ? `/api/visits/${visit.id}` : "/api/visits",
        {
          method: visit ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
        (value) => visitResponseSchema.parse(value),
      );
      router.push(
        `/places/${response.data.restaurantId}?saved=${visit ? "edit" : "visit"}`,
      );
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const fields = { ...caught.body.fieldErrors };
        if (fields.amountSpentCents)
          fields.amountSpent = fields.amountSpentCents;
        setState({ error: caught.message, fields });
      } else {
        setState({
          error:
            "Couldn’t save this visit. Check your connection and try again.",
        });
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel space-y-6 p-6 sm:p-8">
      <input name="restaurantId" type="hidden" value={restaurantId} />
      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}
      <p className="muted mb-0 text-sm">
        Reviewing as{" "}
        <strong className="font-semibold text-ink">{profileName}</strong>.{" "}
        <Link href="/profiles" className="text-accent underline">
          Switch Profile
        </Link>
      </p>
      <div className="grid gap-6">
        <RatingPicker
          key={state.values?.rating ?? "initial"}
          initialValue={state.values?.rating ?? visit?.rating ?? ""}
          error={error("rating")}
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
            defaultValue={state.values?.visitDate ?? visit?.visitDate ?? today}
            aria-invalid={!!error("visitDate")}
            aria-describedby={error("visitDate") ? "date-error" : undefined}
          />
          {error("visitDate") ? (
            <p id="date-error" className="field-error">
              {error("visitDate")}
            </p>
          ) : null}
        </div>
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
          defaultValue={
            state.values?.orderDescription ?? visit?.orderDescription ?? ""
          }
          aria-invalid={!!error("orderDescription")}
          aria-describedby="order-help order-error"
        />
        <p id="order-help" className="muted mb-0 mt-1 text-xs">
          Up to 300 characters.
        </p>
        {error("orderDescription") ? (
          <p id="order-error" className="field-error">
            {error("orderDescription")}
          </p>
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
          rows={5}
          maxLength={2000}
          placeholder="What did you think?"
          defaultValue={state.values?.reviewText ?? visit?.reviewText ?? ""}
          aria-invalid={!!error("reviewText")}
          aria-describedby="review-help review-error"
        />
        <p id="review-help" className="muted mb-0 mt-1 text-xs">
          Up to 2,000 characters.
        </p>
        {error("reviewText") ? (
          <p id="review-error" className="field-error">
            {error("reviewText")}
          </p>
        ) : null}
      </div>
      <div className="max-w-xs">
        <label htmlFor="amountSpent" className="field-label">
          Spent per person{" "}
          <span className="font-normal text-muted">· optional</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-2.5 text-sm text-muted">$</span>
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
            defaultValue={state.values?.amountSpent ?? visit?.amountSpent ?? ""}
            aria-invalid={!!error("amountSpent")}
            aria-describedby="spending-help spending-error"
          />
          <span className="absolute right-4 top-3 text-xs text-muted">USD</span>
        </div>
        <p id="spending-help" className="muted mb-0 mt-2 text-xs">
          Your actual spending, including tax and tip if you like.
        </p>
        {error("amountSpent") ? (
          <p id="spending-error" className="field-error">
            {error("amountSpent")}
          </p>
        ) : null}
      </div>
      <div className="border-t border-line pt-6">
        <p className="muted mb-4 text-xs">
          {visit
            ? "This corrects the existing visit. To record a return visit, use Log a visit instead."
            : "Every return visit gets its own entry. Your latest visit date determines your current score."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn" disabled={pending}>
            {pending ? "Saving visit…" : visit ? "Save changes" : "Save visit"}
          </button>
          <Link href={`/places/${restaurantId}`} className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
