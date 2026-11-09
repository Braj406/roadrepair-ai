"use client";

// Shared layout for sign-in pages: brand panel on the left (desktop only), form on the right.
// Already signed-in users are sent straight to the dashboard.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch, GitCompareArrows, MapPinned, ClipboardCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

const features = [
  { icon: ScanSearch, title: "Detect damage", text: "Potholes and cracks found in ordinary dashcam video." },
  { icon: GitCompareArrows, title: "Track changes", text: "Spot damage that is getting worse between trips." },
  { icon: MapPinned, title: "Map incidents", text: "Every defect on one map, without the duplicates." },
  { icon: ClipboardCheck, title: "Manage repairs", text: "Turn findings into prioritized repair tickets." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#3b25b0_0%,#221a4d_55%,#140f33_100%)] p-12 text-white">
        <Logo light size={42} />

        <div className="relative z-10 max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#d9d0ff] ring-1 ring-white/15">
            Smarter roads. Safer communities.
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Turn dashcam footage into a <span className="text-[#ffb35c]">repair plan</span>.
          </h1>
          <p className="mt-4 text-[#c9c3ef]">
            RoadRepair AI finds road damage, removes duplicate reports, and ranks what your crews should fix first.
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
                <Icon className="mb-2 h-5 w-5 text-[#ffb35c]" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#b5aee6]">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[#8f87c4]">Detect damage. Track changes. Repair smarter.</p>

        {/* Road illustration */}
        <svg className="pointer-events-none absolute -right-24 -bottom-10 h-[70%] opacity-40" viewBox="0 0 400 500" aria-hidden="true">
          <path d="M60 500 C120 360 330 330 300 200 C280 110 160 90 210 0" fill="none" stroke="#6b52e8" strokeWidth="90" />
          <path d="M60 500 C120 360 330 330 300 200 C280 110 160 90 210 0" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="22 22" />
        </svg>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
