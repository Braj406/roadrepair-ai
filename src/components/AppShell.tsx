"use client";

// Signed-in frame: sidebar (desktop), bottom tabs (mobile), top bar with account menu.
// Sends signed-out visitors to /login.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell, ChartColumn, ClipboardList, LayoutDashboard, Loader2, LogOut, MapPinned, Settings, Video,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyze", label: "Analyze Video", icon: Video },
  { href: "/map", label: "Map & Incidents", icon: MapPinned },
  { href: "/tickets", label: "Repair Tickets", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: ChartColumn },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, demoMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || (href === "/map" && pathname.startsWith("/incidents"));

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar p-4 lg:flex">
        <div className="px-2 py-3">
          <Logo light size={34} />
        </div>
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive(href) ? "bg-brand text-white shadow-lg shadow-brand/30" : "text-sidebar-text hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
        {demoMode && (
          <div className="mb-3 rounded-xl bg-white/5 p-3 text-xs text-sidebar-text ring-1 ring-white/10">
            <p className="font-semibold text-white">Demo mode</p>
            Sample data shown. Connect Supabase to save real scans.
          </div>
        )}
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            pathname === "/settings" ? "bg-brand text-white" : "text-sidebar-text hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings className="h-[18px] w-[18px]" /> Settings
        </Link>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-bg/80 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <Logo size={30} />
        </div>
        <p className="hidden truncate text-sm text-muted lg:block">{user.organization || "Your organization"}</p>
        <div className="flex items-center gap-2">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-high ring-2 ring-bg" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#2c1e86] text-sm font-bold text-white"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {initials(user.fullName)}
            </button>
            {menuOpen && (
              <div className="card absolute right-0 mt-2 w-64 p-2">
                <div className="px-3 py-2">
                  <p className="font-semibold">{user.fullName}</p>
                  <p className="truncate text-sm text-muted">{user.email}</p>
                  <p className="mt-1 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold capitalize text-brand">{user.role}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-high hover:bg-high-soft">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${isActive(href) ? "text-brand" : "text-muted"}`}>
            <Icon className="h-5 w-5" />
            {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
