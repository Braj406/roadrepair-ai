"use client";

// Profile details, which backend is in use, and sign out.

import { useRouter } from "next/navigation";
import { Database, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { user, signOut, demoMode } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Your profile and workspace." />

      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold">Profile</h2>
        <dl className="divide-y divide-line text-sm">
          {[
            ["Name", user.fullName],
            ["Email", user.email],
            ["Organization", user.organization || "—"],
            ["Role", <span key="r" className="capitalize">{user.role}</span>],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card mb-6 flex items-start gap-3 p-5">
        <Database className="mt-0.5 h-5 w-5 text-brand" />
        <div className="text-sm">
          <p className="font-bold">Backend: {demoMode ? "Demo mode" : "Supabase connected"}</p>
          <p className="text-muted">
            {demoMode
              ? "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to turn on real accounts."
              : "Accounts and data are stored in your Supabase project."}
          </p>
        </div>
      </section>

      <button onClick={async () => { await signOut(); router.replace("/login"); }} className="btn-secondary text-high">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
