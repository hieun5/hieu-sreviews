import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Navigation } from "@/components/navigation";
import { Brand } from "@/components/ui";
import { requireProfile } from "@/lib/profile";

export default async function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Brand />
            <Navigation />
            <div className="topbar-actions">
              <Link
                href="/profiles"
                className="profile-switch"
                aria-label={`Switch Profile · ${profile.name}`}
              >
                <Avatar profile={profile} size={32} />
                <span>
                  <span className="profile-switch-name">{profile.name}</span>
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
      </div>
    </>
  );
}
