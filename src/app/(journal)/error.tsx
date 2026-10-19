"use client";

import Link from "next/link";

export default function JournalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel p-8" role="alert">
      <h1 className="display mb-3 text-2xl">Couldn’t load this page</h1>
      <p className="muted mb-6 max-w-xl text-sm">
        Try again, or check the database setup if this keeps happening.
      </p>
      <div className="flex gap-3">
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-secondary" href="/profiles">
          Switch Profile
        </Link>
      </div>
    </section>
  );
}
