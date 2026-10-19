import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="display mb-3 text-3xl">Page not found</h1>
      <p className="muted mb-7">
        The place or visit may have been removed, or this link may be out of
        date.
      </p>
      <Link href="/" className="btn">
        Back to Home
      </Link>
    </main>
  );
}
