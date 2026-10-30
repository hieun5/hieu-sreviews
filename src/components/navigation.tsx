"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Sparkles } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
];

export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="app-nav">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} className="nav-icon" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
