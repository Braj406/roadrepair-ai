"use client";

// Sign-in page: email and password, Google, and (in demo mode only) a one-click demo account.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Alert, DemoModeNote, Divider, Field, GoogleButton, PasswordInput } from "@/components/AuthBits";

export default function LoginPage() {
  const { signIn, signInWithGoogle, signInAsDemo, demoMode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.replace("/dashboard");
  }

  async function google() {
    setError(null);
    const res = await signInWithGoogle();
    if (res.error) setError(res.error);
  }

  async function demo() {
    await signInAsDemo();
    router.replace("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-muted">Sign in to review incidents and manage repairs.</p>
      </div>

      {demoMode && <DemoModeNote />}

      {demoMode && (
      <button type="button" onClick={demo} className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft/60 px-4 py-3 text-left transition hover:bg-brand-soft">
        <PlayCircle className="h-8 w-8 shrink-0 text-brand" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink">Try the demo account</span>
          <span className="block text-xs text-muted">Explore with sample data. No sign-up needed.</span>
        </span>
        <ArrowRight className="h-4 w-4 text-brand transition group-hover:translate-x-0.5" />
      </button>
      )}

      <GoogleButton onClick={google} />
      <Divider text="or sign in with email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <Field label="Work email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" placeholder="you@city.gov"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={<Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link>}
        >
          <PasswordInput id="password" autoComplete="current-password" required placeholder="Your password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--brand)]" />
          Keep me signed in
        </label>

        <button type="submit" disabled={busy || !email || !password} className="btn-primary w-full py-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        New to RoadRepair AI?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
