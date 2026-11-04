"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { switchReviewProfile } from "@/app/actions";
import { findProfile } from "@/config/profiles";
import { ReviewerPicker } from "./reviewer-picker";
import { visitResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";
import { usdToCents } from "@/lib/client/money";
import type { Visit } from "@/db/schema";
import type { FormState } from "@/lib/action-state";
import { RatingPicker } from "./rating-picker";

export function VisitForm({
  restaurantId,
  profileName,
  profileId,
  today,
  visit,
}: {
  restaurantId: string;
  profileName: string;
  profileId: string;
  today: string;
  visit?: Visit;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);
  const [reviewer, setReviewer] = useState(profileId);
  const [switching, setSwitching] = useState(false);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formVersion, setFormVersion] = useState(0);
  useLayoutEffect(
    () => () => {
      formRef.current?.reset();
      setFormVersion((version) => version + 1);
      setState({});
    },
    [],
  );
  useEffect(() => {
    const onReturn = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onReturn);
    return () => window.removeEventListener("pageshow", onReturn);
  }, []);
  async function chooseReviewer(id: string) {
    if (busy.current || id === reviewer) return;
    busy.current = true;
    setSwitching(true);
    try {
      const result = await switchReviewProfile(id);
      if (result.error) setState({ error: result.error });
      else {
        setReviewer(id);
        setState({});
        router.refresh();
      }
    } catch {
      setState({
        error:
          "Couldn’t switch reviewers. Your review is still here. Try again.",
      });
    } finally {
      busy.current = false;
      setSwitching(false);
    }
  }
  const error = (key: string) => state.fields?.[key]?.[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
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
      busy.current = false;
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
    let saved = false;
    try {
      const response = await requestJson(
        visit ? `/api/visits/${visit.id}` : "/api/visits",
        {
          method: visit ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
        (value) => visitResponseSchema.parse(value),
      );
      saved = true;
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
      if (!saved) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const optionalError = ["visitDate", "orderDescription", "amountSpent"].some(
    (key) => !!error(key),
  );
  return (
    <form
      ref={formRef}
      autoComplete="off"
      onSubmit={submit}
      className="panel journal-form space-y-6 p-5 sm:p-7"
    >
      <input name="restaurantId" type="hidden" value={restaurantId} />
      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}
      {!visit ? (
        <ReviewerPicker
          selectedId={reviewer}
          onSelect={(id) => void chooseReviewer(id)}
          disabled={pending || switching}
        />
      ) : null}
      <p className="muted mb-0 text-sm" role="status">
        {switching ? (
          "Switching reviewer…"
        ) : (
          <>
            Reviewing as{" "}
            <strong className="text-ink">
              {findProfile(reviewer)?.name ?? profileName}
            </strong>
            .
          </>
        )}
      </p>
      <fieldset disabled={pending || switching} className="space-y-6">
        <RatingPicker
          key={formVersion}
          initialValue={visit?.rating ?? ""}
          error={error("rating")}
        />
        <div>
          <label htmlFor="reviewText" className="ticket-label">
            A little review <span>optional</span>
          </label>
          <textarea
            id="reviewText"
            name="reviewText"
            className="input"
            rows={3}
            maxLength={2000}
            defaultValue={visit?.reviewText ?? ""}
            aria-invalid={!!error("reviewText")}
            aria-describedby={error("reviewText") ? "review-error" : undefined}
          />
          {error("reviewText") ? (
            <p id="review-error" className="field-error">
              {error("reviewText")}
            </p>
          ) : null}
        </div>
        <details className="ticket-details" open={optionalError || undefined}>
          <summary>Add dishes, date or spending</summary>
          <div className="ticket-detail-fields">
            <div>
              <label htmlFor="orderDescription" className="field-label">
                What did you order?
              </label>
              <textarea
                id="orderDescription"
                name="orderDescription"
                className="input"
                rows={2}
                maxLength={300}
                placeholder="What you had"
                defaultValue={visit?.orderDescription ?? ""}
                aria-invalid={!!error("orderDescription")}
                aria-describedby={
                  error("orderDescription") ? "visit-order-error" : undefined
                }
              />
              {error("orderDescription") ? (
                <p id="visit-order-error" className="field-error">
                  {error("orderDescription")}
                </p>
              ) : null}
            </div>
            <div className="detail-pair">
              <div>
                <label htmlFor="visitDate" className="field-label">
                  Visit date
                </label>
                <input
                  id="visitDate"
                  name="visitDate"
                  className="input"
                  type="date"
                  max={today}
                  defaultValue={visit?.visitDate ?? today}
                  aria-invalid={!!error("visitDate")}
                  aria-describedby={
                    error("visitDate") ? "visit-date-error" : undefined
                  }
                />
                {error("visitDate") ? (
                  <p id="visit-date-error" className="field-error">
                    {error("visitDate")}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="amountSpent" className="field-label">
                  Spent per person · USD
                </label>
                <input
                  id="amountSpent"
                  name="amountSpent"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  placeholder="$0.00"
                  defaultValue={visit?.amountSpent ?? ""}
                  aria-invalid={!!error("amountSpent")}
                  aria-describedby={
                    error("amountSpent") ? "visit-amount-error" : undefined
                  }
                />
                {error("amountSpent") ? (
                  <p id="visit-amount-error" className="field-error">
                    {error("amountSpent")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </details>
        <div className="border-t border-line pt-5">
          {visit ? (
            <p className="muted mb-4 text-xs">
              Editing this review. For another trip, log a new visit from the
              place page.
            </p>
          ) : null}
          <div className="form-actions flex flex-wrap gap-3">
            <button className="btn" disabled={pending}>
              {pending ? "Saving…" : visit ? "Save changes" : "Save my review"}
            </button>
            <Link
              href={`/places/${restaurantId}`}
              className="btn btn-secondary"
            >
              Cancel
            </Link>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
