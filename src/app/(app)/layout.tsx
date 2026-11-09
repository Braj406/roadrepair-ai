// Layout for signed-in pages. AppShell reads the current URL, which Next.js 16
// requires to sit inside <Suspense> so the rest of the page can render first.
import { Suspense } from "react";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
