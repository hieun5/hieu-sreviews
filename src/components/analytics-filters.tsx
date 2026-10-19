"use client";

import Link from "next/link";
import { useState } from "react";

export type AnalyticsFilterValues = {
  view: string;
  profile: string;
  restaurant: string;
  cuisine: string;
  start: string;
  end: string;
};

export function AnalyticsFiltersForm({
  values,
  profiles,
  places,
  cuisines,
  today,
}: {
  values: AnalyticsFilterValues;
  profiles: { id: string; name: string }[];
  places: { id: string; name: string }[];
  cuisines: string[];
  today: string;
}) {
  const [view, setView] = useState(values.view);
  return (
    <form
      action="/analytics"
      className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div>
        <label htmlFor="view" className="field-label">
          View
        </label>
        <select
          id="view"
          name="view"
          className="input"
          value={view}
          onChange={(event) => setView(event.target.value)}
        >
          <option value="group">Our group</option>
          <option value="personal">One person</option>
        </select>
      </div>
      <div>
        <label htmlFor="profile" className="field-label">
          Profile
        </label>
        <select
          id="profile"
          name="profile"
          className="input disabled:opacity-50"
          defaultValue={values.profile}
          disabled={view === "group"}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="restaurant" className="field-label">
          Place
        </label>
        <select
          id="restaurant"
          name="restaurant"
          className="input"
          defaultValue={values.restaurant}
        >
          <option value="">All places</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cuisine" className="field-label">
          Cuisine / category
        </label>
        <select
          id="cuisine"
          name="cuisine"
          className="input"
          defaultValue={values.cuisine}
        >
          <option value="">All categories</option>
          {cuisines.map((cuisine) => (
            <option key={cuisine}>{cuisine}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="start" className="field-label">
          From
        </label>
        <input
          id="start"
          name="start"
          type="date"
          className="input"
          max={today}
          defaultValue={values.start}
        />
      </div>
      <div>
        <label htmlFor="end" className="field-label">
          Through
        </label>
        <input
          id="end"
          name="end"
          type="date"
          className="input"
          max={today}
          defaultValue={values.end}
        />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2">
        <button className="btn">Apply filters</button>
        <Link href="/analytics" className="btn btn-quiet">
          Reset
        </Link>
      </div>
    </form>
  );
}
