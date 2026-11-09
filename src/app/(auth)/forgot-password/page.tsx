"use client";

// Sends a password reset email. Always shows the same message so it doesn't reveal which emails have accounts.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Alert, Field } from "@/components/AuthBits";

export default function ForgotPasswordPage() {
  const { resetPassword, demoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await resetPassword(email.trim());
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  }

  return (
    <div className="space-y-6">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
        {sent ? <MailCheck className="h-6 w-6 text-brand" /> : <KeyRound className="h-6 w-6 text-brand" />}
      </div>

      {sent ? (
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Check your email</h2>
          <p className="mt-2 text-muted">
            If an account exists for <strong className="text-ink">{email}</strong>, you&apos;ll get a link to reset your password.
            {demoMode && " (Demo mode doesn't send real emails.)"}
          </p>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Reset your password</h2>
            <p className="mt-1.5 text-muted">Enter your work email and we&apos;ll send you a reset link.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Work email" htmlFor="email">
              <input id="email" type="email" required autoComplete="email" className="input" placeholder="you@city.gov" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" disabled={busy || !email} className="btn-primary w-full py-3">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
