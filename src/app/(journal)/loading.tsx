export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading journal"
      className="loading-skeleton"
    >
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-12 w-3/4" />
      <div className="flex gap-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="skeleton size-12 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-96 w-full" />
    </div>
  );
}
