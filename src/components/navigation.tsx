"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Plus,
  MapPin,
  ChartNoAxesCombined,
  Store,
} from "lucide-react";
const links = [
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/", label: "Add review", icon: Plus },
  { href: "/places", label: "Places", icon: Store },
  { href: "/recommendations", label: "Pick a place", icon: MapPin },
  { href: "/analytics", label: "Food stats", icon: ChartNoAxesCombined },
];
export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="app-nav">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? path === "/" ||
              path === "/places/new" ||
              path.includes("/visits/")
            : href === "/places"
              ? path.startsWith("/places") &&
                path !== "/places/new" &&
                !path.includes("/visits/")
              : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} className="nav-icon" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
