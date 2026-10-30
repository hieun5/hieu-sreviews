"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function RestaurantSearch({
  query,
  view,
}: {
  query: string;
  view: string;
}) {
  const [open, setOpen] = useState(Boolean(query));
  const inputRef = useRef<HTMLInputElement>(null);
  const focusOnOpen = useRef(false);

  useEffect(() => {
    if (open && focusOnOpen.current) {
      inputRef.current?.focus();
      focusOnOpen.current = false;
    }
  }, [open]);

  if (!open)
    return (
      <button
        type="button"
        className="restaurant-search-button"
        aria-label="Search restaurants"
        aria-expanded="false"
        onClick={() => {
          focusOnOpen.current = true;
          setOpen(true);
        }}
      >
        <Search size={19} aria-hidden="true" />
      </button>
    );

  return (
    <form action="/" role="search" className="restaurant-search-form">
      <input type="hidden" name="view" value={view} />
      <label className="sr-only" htmlFor="restaurant-search">
        Search saved restaurants
      </label>
      <input
        ref={inputRef}
        id="restaurant-search"
        name="q"
        type="search"
        enterKeyHint="search"
        className="input"
        placeholder="Search restaurants"
        defaultValue={query}
        maxLength={300}
      />
      <button
        type="submit"
        className="restaurant-search-button"
        aria-label="Search restaurants"
      >
        <Search size={19} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="restaurant-search-close"
        aria-label="Close restaurant search"
        onClick={() => setOpen(false)}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
