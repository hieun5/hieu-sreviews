import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
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
            <Link href="/profiles" className="profile-switch">
              <Avatar profile={profile} size={32} />
              <span>
                <span className="block text-xs font-semibold">
                  {profile.name}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  Switch Profile <ArrowLeftRight size={10} aria-hidden="true" />
                </span>
              </span>
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
      </div>
    </>
  );
}
