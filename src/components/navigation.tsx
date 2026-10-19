"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/places", label: "Places" },
  { href: "/analytics", label: "Analytics" },
  { href: "/recommendations", label: "Recommendations" },
];

export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="app-nav">
      {links.map(({ href, label }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
