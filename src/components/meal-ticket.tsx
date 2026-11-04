"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Search, Plus } from "lucide-react";
import { switchReviewProfile } from "@/app/actions";
import { friendProfiles } from "@/config/profiles";
import { visitResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";
import { usdToCents } from "@/lib/client/money";
import { RatingPicker } from "./rating-picker";
import { ReviewerPicker } from "./reviewer-picker";
import {
  emptyMealFields,
  mealDraftKey,
  removeMealDraft,
  type MealDraftFields,
} from "@/lib/client/meal-draft";

type PlaceOption = { id: string; name: string; address: string; kind: string };

export function MealTicket({
  places,
  selectedProfileId,
  today,
  newPlace = false,
}: {
  places: PlaceOption[];
  selectedProfileId: string;
  today: string;
  newPlace?: boolean;
}) {
  const router = useRouter();
  const [reviewer, setReviewer] = useState(selectedProfileId);
  const [switching, setSwitching] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [adding, setAdding] = useState(newPlace);
  const [placeMode, setPlaceMode] = useState<"new" | "saved" | null>(
    newPlace ? "new" : null,
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [duplicates, setDuplicates] = useState<
    { id: string; name: string; address: string }[]
  >([]);
  const [confirmed, setConfirmed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [values, setValues] = useState(() => emptyMealFields(today));
  const saving = useRef(false);
  const changingReviewer = useRef(false);
  useEffect(() => {
    // Remove drafts saved by earlier versions; unfinished reviews now live
    // only in this mounted form.
    removeMealDraft(mealDraftKey(false));
    removeMealDraft(mealDraftKey(true));
    const onReturn = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onReturn);
    return () => window.removeEventListener("pageshow", onReturn);
  }, []);
  useLayoutEffect(
    () => () => {
      setQuery("");
      setPlaceId(null);
      setAdding(newPlace);
      setPlaceMode(newPlace ? "new" : null);
      setValues(emptyMealFields(today));
      setOpen(false);
      setActive(-1);
      setDetailsOpen(false);
      setError("");
      setFields({});
      setDuplicates([]);
      setConfirmed(false);
    },
    [newPlace, today],
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const matches = places
    .filter((place) =>
      `${place.name} ${place.address}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .slice(0, 6);
  const reviewerName = friendProfiles.find(
    (profile) => profile.id === reviewer,
  )?.name;
  const fieldError = (...keys: string[]) =>
    keys.flatMap((key) => fields[key] ?? [])[0];
  const placeError = fieldError("place.name", "restaurantId");

  function changeField<Key extends keyof MealDraftFields>(
    key: Key,
    value: MealDraftFields[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  async function chooseReviewer(id: string) {
    if (id === reviewer || changingReviewer.current || saving.current) return;
    changingReviewer.current = true;
    setSwitching(true);
    try {
      const result = await switchReviewProfile(id);
      if (result.error) showError(result.error);
      else {
        setReviewer(id);
        router.refresh();
      }
    } catch {
      showError("Couldn’t switch reviewers. Try again before saving.");
    } finally {
      changingReviewer.current = false;
      setSwitching(false);
    }
  }

  function choosePlace(place: PlaceOption) {
    setPlaceMode("saved");
    setPlaceId(place.id);
    setQuery(place.name);
    setAdding(false);
    setOpen(false);
    setActive(-1);
    setDuplicates([]);
    setConfirmed(false);
  }

  function addPlace() {
    setPlaceMode("new");
    setAdding(true);
    setPlaceId(null);
    setOpen(false);
    setActive(-1);
  }

  function searchKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (adding) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) =>
        event.key === "ArrowDown"
          ? Math.min(index + 1, matches.length)
          : Math.max(index - 1, 0),
      );
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      if (active < matches.length) choosePlace(matches[active]);
      else addPlace();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placeMode) {
      showError("Choose Add new place or Review saved places first.");
      return;
    }
    if (saving.current || changingReviewer.current) return;
    setError("");
    setFields({});
    const form = new FormData(event.currentTarget);
    const exact = places.filter(
      (place) =>
        place.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
    );
    const restaurantId =
      placeId ?? (!adding && exact.length === 1 ? exact[0].id : null);
    if (!restaurantId && !adding) {
      setOpen(true);
      showError(
        "Choose a saved place, or select “Add a new place” below the search.",
      );
      return;
    }
    let amountSpentCents: number | null;
    try {
      amountSpentCents = usdToCents(String(form.get("amountSpent") ?? ""));
    } catch (caught) {
      setDetailsOpen(true);
      setFields({
        amountSpentCents: [
          caught instanceof Error
            ? caught.message
            : "Enter a valid USD amount.",
        ],
      });
      showError("Check the spending amount and try again.");
      return;
    }
    const visit = {
      rating: Number(form.get("rating")),
      visitDate: String(form.get("visitDate") ?? today),
      reviewText: String(form.get("reviewText") ?? ""),
      orderDescription: String(form.get("orderDescription") ?? ""),
      amountSpentCents,
    };
    saving.current = true;
    setPending(true);
    let saved = false;
    try {
      const response = await requestJson(
        restaurantId ? "/api/visits" : "/api/places/with-visit",
        {
          method: "POST",
          body: JSON.stringify(
            restaurantId
              ? { restaurantId, ...visit }
              : {
                  place: {
                    name: query.trim(),
                    address: String(form.get("address") ?? ""),
                    kind: String(form.get("kind") ?? "restaurant"),
                    cuisines: String(form.get("cuisines") ?? "")
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                    priceTier: form.get("priceTier")
                      ? Number(form.get("priceTier"))
                      : null,
                    confirmDuplicate: confirmed,
                  },
                  visit,
                },
          ),
        },
        (value) => visitResponseSchema.parse(value),
      );
      saved = true;
      router.push(`/places/${response.data.restaurantId}?saved=visit`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFields(caught.body.fieldErrors);
        setDuplicates(caught.body.details?.duplicates ?? []);
        if (
          Object.keys(caught.body.fieldErrors).some(
            (key) =>
              ![
                "rating",
                "visit.rating",
                "reviewText",
                "visit.reviewText",
                "place.name",
                "restaurantId",
              ].includes(key),
          )
        )
          setDetailsOpen(true);
        showError(
          caught.body.code === "DATABASE_UNCONFIGURED" ||
            caught.body.code === "DATABASE_UNAVAILABLE"
            ? "The journal can’t save right now. Your entries are still in this form. Please try again later."
            : caught.message,
        );
      } else
        showError(
          "Couldn’t save your review. Your entries are still in this form. Please try again.",
        );
    } finally {
      if (!saved) {
        saving.current = false;
        setPending(false);
      }
    }
  }

  return (
    <div>
      <ReviewerPicker
        selectedId={reviewer}
        onSelect={(id) => void chooseReviewer(id)}
        disabled={switching || pending}
      />
      <p className="sr-only" role="status">
        {switching ? "Switching reviewer…" : `Reviewing as ${reviewerName}`}
      </p>
      <form
        className="meal-ticket"
        autoComplete="off"
        onSubmit={submit}
        aria-label="Log a meal"
        aria-busy={pending || switching}
        onInvalidCapture={(event) => {
          const details = (event.target as HTMLElement).closest("details");
          if (details) {
            details.open = true;
            setDetailsOpen(true);
          }
        }}
      >
        {error ? (
          <div
            ref={alertRef}
            tabIndex={-1}
            role="alert"
            className="notice notice-error"
          >
            {error}
          </div>
        ) : null}
        <fieldset disabled={pending || switching}>
          {duplicates.length ? (
            <div className="duplicate-notice">
              <p className="field-label">Already around our table?</p>
              {duplicates.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="duplicate-match"
                  onClick={() => choosePlace({ ...place, kind: "restaurant" })}
                >
                  {place.name}
                  <ArrowRight size={16} />
                </button>
              ))}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                This is a different place.
              </label>
            </div>
          ) : null}
          <div className="ticket-place">
            <label htmlFor="meal-place" className="ticket-label">
              The place
            </label>
            <div
              className="place-mode-buttons"
              role="group"
              aria-label="Choose how to review"
            >
              {(["new", "saved"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={placeMode === mode}
                  aria-controls="place-mode-field"
                  onClick={() => {
                    setPlaceMode(mode);
                    setAdding(mode === "new");
                    setPlaceId(null);
                    setOpen(mode === "saved");
                    setActive(-1);
                    setDuplicates([]);
                    setConfirmed(false);
                    requestAnimationFrame(() =>
                      document.getElementById("meal-place")?.focus(),
                    );
                  }}
                >
                  {mode === "new" ? (
                    <Plus size={17} aria-hidden="true" />
                  ) : (
                    <Search size={17} aria-hidden="true" />
                  )}
                  {mode === "new" ? "Add new place" : "Review saved places"}
                </button>
              ))}
            </div>
            <div
              id="place-mode-field"
              className="place-mode-field"
              data-open={placeMode !== null}
            >
              <div className="place-mode-inner" inert={placeMode === null}>
                <div
                  className="place-combobox"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      setOpen(false);
                  }}
                >
                  <div className="search-input-wrap">
                    <Search size={20} aria-hidden="true" />
                    <input
                      id="meal-place"
                      name="placeName"
                      className="input"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPlaceId(null);
                        setOpen(!adding);
                        setActive(-1);
                        setDuplicates([]);
                        setConfirmed(false);
                      }}
                      onFocus={() => {
                        if (!adding) setOpen(true);
                      }}
                      onKeyDown={searchKeys}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={open && !adding}
                      aria-controls="meal-place-options"
                      aria-activedescendant={
                        open && active >= 0
                          ? `meal-option-${active}`
                          : undefined
                      }
                      aria-invalid={!!placeError}
                      aria-describedby={
                        placeError ? "meal-place-error" : undefined
                      }
                      placeholder={
                        adding
                          ? "Restaurant or café name"
                          : "Find a place or add a new one"
                      }
                      autoComplete="off"
                      required={placeMode !== null}
                      maxLength={160}
                      disabled={pending}
                    />
                    {placeId ? (
                      <Check
                        size={18}
                        className="search-selected"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  {open && !adding ? (
                    <div
                      id="meal-place-options"
                      role="listbox"
                      aria-label="Saved places"
                      className="place-options"
                    >
                      {matches.map((place, index) => (
                        <button
                          id={`meal-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected={placeId === place.id}
                          data-active={active === index}
                          key={place.id}
                          onClick={() => choosePlace(place)}
                          className="place-option"
                        >
                          <span>
                            {place.name}
                            {place.address ? (
                              <small>{place.address}</small>
                            ) : null}
                          </span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      ))}
                      <button
                        id={`meal-option-${matches.length}`}
                        type="button"
                        role="option"
                        aria-selected={false}
                        data-active={active === matches.length}
                        onClick={addPlace}
                        className="place-option add-place-option"
                      >
                        <Plus size={17} aria-hidden="true" />
                        <span>
                          {query.trim()
                            ? `Add “${query.trim()}”`
                            : "Add a new place"}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
                {placeError ? (
                  <p className="field-error" id="meal-place-error">
                    {placeError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="ticket-rating">
            <RatingPicker
              initialValue=""
              value={values.rating}
              onChange={(value) => changeField("rating", value)}
              error={fieldError("rating", "visit.rating")}
            />
          </div>
          <div className="ticket-review">
            <label htmlFor="reviewText" className="ticket-label">
              A little review <span>optional</span>
            </label>
            <textarea
              id="reviewText"
              name="reviewText"
              className="input"
              rows={2}
              maxLength={2000}
              value={values.reviewText}
              onChange={(event) =>
                changeField("reviewText", event.target.value)
              }
              aria-invalid={!!fieldError("reviewText", "visit.reviewText")}
              aria-describedby={
                fieldError("reviewText", "visit.reviewText")
                  ? "meal-review-error"
                  : undefined
              }
              disabled={pending}
            />
            {fieldError("reviewText", "visit.reviewText") ? (
              <p id="meal-review-error" className="field-error">
                {fieldError("reviewText", "visit.reviewText")}
              </p>
            ) : null}
          </div>
          <details
            className="ticket-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>Add dishes, date or spending</summary>
            <div className="ticket-detail-fields">
              <div>
                <label htmlFor="orderDescription" className="field-label">
                  What did you order?
                </label>
                <input
                  id="orderDescription"
                  name="orderDescription"
                  className="input"
                  maxLength={300}
                  placeholder="The usual? Something new?"
                  value={values.orderDescription}
                  onChange={(event) =>
                    changeField("orderDescription", event.target.value)
                  }
                  aria-invalid={
                    !!fieldError("orderDescription", "visit.orderDescription")
                  }
                  aria-describedby={
                    fieldError("orderDescription", "visit.orderDescription")
                      ? "meal-order-error"
                      : undefined
                  }
                />
                {fieldError("orderDescription", "visit.orderDescription") ? (
                  <p id="meal-order-error" className="field-error">
                    {fieldError("orderDescription", "visit.orderDescription")}
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
                    value={values.visitDate}
                    onChange={(event) =>
                      changeField("visitDate", event.target.value)
                    }
                    max={today}
                    aria-invalid={!!fieldError("visitDate", "visit.visitDate")}
                    aria-describedby={
                      fieldError("visitDate", "visit.visitDate")
                        ? "meal-date-error"
                        : undefined
                    }
                  />
                  {fieldError("visitDate", "visit.visitDate") ? (
                    <p id="meal-date-error" className="field-error">
                      {fieldError("visitDate", "visit.visitDate")}
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
                    value={values.amountSpent}
                    onChange={(event) =>
                      changeField("amountSpent", event.target.value)
                    }
                    aria-invalid={
                      !!fieldError("amountSpentCents", "visit.amountSpentCents")
                    }
                    aria-describedby={
                      fieldError("amountSpentCents", "visit.amountSpentCents")
                        ? "meal-amount-error"
                        : undefined
                    }
                  />
                  {fieldError("amountSpentCents", "visit.amountSpentCents") ? (
                    <p id="meal-amount-error" className="field-error">
                      {fieldError("amountSpentCents", "visit.amountSpentCents")}
                    </p>
                  ) : null}
                </div>
              </div>
              {adding ? (
                <>
                  <div className="detail-pair">
                    <div>
                      <label htmlFor="kind" className="field-label">
                        Place type
                      </label>
                      <select
                        id="kind"
                        name="kind"
                        className="input"
                        value={values.kind}
                        onChange={(event) =>
                          changeField(
                            "kind",
                            event.target.value as MealDraftFields["kind"],
                          )
                        }
                      >
                        <option value="restaurant">Restaurant</option>
                        <option value="cafe">Café</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="priceTier" className="field-label">
                        Price range
                      </label>
                      <select
                        id="priceTier"
                        name="priceTier"
                        className="input"
                        value={values.priceTier}
                        onChange={(event) =>
                          changeField(
                            "priceTier",
                            event.target.value as MealDraftFields["priceTier"],
                          )
                        }
                      >
                        <option value="">Not sure</option>
                        {[1, 2, 3, 4].map((tier) => (
                          <option key={tier} value={tier}>
                            {"$".repeat(tier)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address" className="field-label">
                      Address · optional
                    </label>
                    <input
                      id="address"
                      name="address"
                      className="input"
                      maxLength={300}
                      placeholder="Useful when there’s more than one location"
                      value={values.address}
                      onChange={(event) =>
                        changeField("address", event.target.value)
                      }
                      aria-describedby={
                        fieldError("place.address")
                          ? "meal-address-error"
                          : undefined
                      }
                      aria-invalid={!!fieldError("place.address")}
                    />
                    {fieldError("place.address") ? (
                      <p id="meal-address-error" className="field-error">
                        {fieldError("place.address")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="cuisines" className="field-label">
                      Cuisines · optional
                    </label>
                    <input
                      id="cuisines"
                      name="cuisines"
                      className="input"
                      maxLength={480}
                      placeholder="Vietnamese, noodles, comfort food…"
                      value={values.cuisines}
                      onChange={(event) =>
                        changeField("cuisines", event.target.value)
                      }
                      aria-describedby={
                        fieldError("place.cuisines")
                          ? "meal-cuisines-error"
                          : undefined
                      }
                      aria-invalid={!!fieldError("place.cuisines")}
                    />
                    {fieldError("place.cuisines") ? (
                      <p id="meal-cuisines-error" className="field-error">
                        {fieldError("place.cuisines")}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </details>
          <button className="btn ticket-save" disabled={pending || switching}>
            {pending
              ? "Saving your review…"
              : switching
                ? "Switching reviewer…"
                : "Save my review"}
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </fieldset>
      </form>
    </div>
  );
}
