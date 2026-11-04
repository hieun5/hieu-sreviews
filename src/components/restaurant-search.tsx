"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useRef, useState } from "react";

export function RestaurantSearch({ query }: { query: string }) {
  const [expanded, setExpanded] = useState(Boolean(query));
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!expanded)
    return (
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary mb-5"
        aria-label="Search places"
        aria-expanded={false}
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Search size={21} aria-hidden="true" />
      </button>
    );
  return (
    <form
      action="/places"
      role="search"
      className="restaurant-search-form journal-search-form"
    >
      <div className="search-input-wrap">
        <Search size={19} aria-hidden="true" />
        <label className="sr-only" htmlFor="restaurant-search">
          Search places
        </label>
        <input
          id="restaurant-search"
          ref={inputRef}
          name="q"
          type="search"
          enterKeyHint="search"
          className="input"
          defaultValue={query}
          maxLength={300}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !query) {
              event.preventDefault();
              setExpanded(false);
              requestAnimationFrame(() => buttonRef.current?.focus());
            }
          }}
        />
      </div>
      <button className="btn btn-secondary" aria-label="Search places">
        <Search size={21} aria-hidden="true" />
      </button>
      {query ? (
        <Link href="/places" className="btn btn-quiet">
          Clear
        </Link>
      ) : null}
    </form>
  );
}
