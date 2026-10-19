"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { restaurantResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";
import type { FormState } from "@/lib/action-state";

export function RestaurantForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);
  const error = (key: string) => state.fields?.[key]?.[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({});
    const form = new FormData(event.currentTarget);
    try {
      const response = await requestJson(
        "/api/restaurants",
        {
          method: "POST",
          body: JSON.stringify({
            name: String(form.get("name") ?? ""),
            address: String(form.get("address") ?? ""),
            kind: String(form.get("kind") ?? "restaurant"),
            cuisines: String(form.get("cuisines") ?? "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            priceTier: form.get("priceTier")
              ? Number(form.get("priceTier"))
              : null,
            confirmDuplicate: form.has("duplicateConfirmed"),
          }),
        },
        (value) => restaurantResponseSchema.parse(value),
      );
      router.push(`/places/${response.data.id}?saved=place`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const duplicates = caught.body.details?.duplicates;
        setState({
          error: caught.message,
          fields: caught.body.fieldErrors,
          duplicates,
        });
      } else {
        setState({
          error:
            "Couldn’t save this place. Check your connection and try again.",
        });
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel space-y-6 p-6 sm:p-8">
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
                <span className="muted block text-xs">{place.address}</span>
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
            aria-invalid={!!error("name")}
            aria-describedby={error("name") ? "name-error" : undefined}
          />
          {error("name") ? (
            <p id="name-error" className="field-error">
              {error("name")}
            </p>
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
        <label htmlFor="address" className="field-label">
          Address <span className="text-accent">*</span>
        </label>
        <input
          id="address"
          name="address"
          className="input"
          placeholder="Street address, city, and region"
          required
          maxLength={300}
          defaultValue={state.values?.address}
          aria-invalid={!!error("address")}
          aria-describedby={error("address") ? "address-error" : undefined}
        />
        {error("address") ? (
          <p id="address-error" className="field-error">
            {error("address")}
          </p>
        ) : null}
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
          aria-invalid={!!error("cuisines")}
          aria-describedby="cuisines-help cuisines-error"
        />
        <p id="cuisines-help" className="muted mb-0 mt-2 text-xs">
          Separate categories with commas. Up to eight categories.
        </p>
        {error("cuisines") ? (
          <p id="cuisines-error" className="field-error">
            {error("cuisines")}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="priceTier" className="field-label">
          Listed price tier{" "}
          <span className="font-normal text-muted">· optional</span>
        </label>
        <select
          id="priceTier"
          name="priceTier"
          className="input max-w-xs"
          defaultValue={state.values?.priceTier || ""}
          aria-describedby="price-help"
        >
          <option value="">Unknown / not recorded</option>
          <option value="1">$</option>
          <option value="2">$$</option>
          <option value="3">$$$</option>
          <option value="4">$$$$</option>
        </select>
        <p id="price-help" className="muted mb-0 mt-2 text-xs">
          Only enter a tier you know. Actual spending is recorded separately on
          each visit.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <button className="btn" disabled={pending}>
          {pending ? "Saving place…" : "Save place"}
        </button>
        <Link href="/places" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
