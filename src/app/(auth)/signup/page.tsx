"use client";

// Create-account page: name, work email, organization, role and a password with live strength checks.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, HardHat, Loader2, MailCheck, ScanSearch, ShieldCheck } from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { Alert, DemoModeNote, Divider, Field, GoogleButton, PasswordInput } from "@/components/AuthBits";

const roles: { value: Role; label: string; text: string; icon: typeof ShieldCheck }[] = [
  { value: "admin", label: "Admin", text: "Manage team and settings", icon: ShieldCheck },
  { value: "inspector", label: "Inspector", text: "Upload and review scans", icon: ScanSearch },
  { value: "crew", label: "Repair crew", text: "Work assigned tickets", icon: HardHat },
];

// Each rule met fills one bar of the strength meter. At least 3 of 4 are required.
function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw), label: "Upper and lower case" },
    { ok: /\d/.test(pw), label: "A number" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "A symbol" },
  ];
}

export default function SignupPage() {
  const { signUp, signInWithGoogle, demoMode } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState<Role>("inspector");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const score = checks.filter((c) => c.ok).length;
  const strength = ["Too weak", "Weak", "Okay", "Good", "Strong"][score];
  const strengthColor = ["bg-line", "bg-high", "bg-medium", "bg-low", "bg-ok"][score];

  const canSubmit = fullName.trim() && /\S+@\S+\.\S+/.test(email) && organization.trim() && score >= 3 && agree;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    const res = await signUp({ fullName: fullName.trim(), email: email.trim(), organization: organization.trim(), role, password });
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.needsConfirmation) setSentTo(email.trim());
    else router.replace("/dashboard");
  }

  async function google() {
    setError(null);
    const res = await signInWithGoogle();
    if (res.error) setError(res.error);
  }

  if (sentTo) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
          <MailCheck className="h-7 w-7 text-brand" />
        </div>
        <h2 className="text-2xl font-extrabold">Check your email</h2>
        <p className="mt-2 text-muted">
          We sent a confirmation link to <strong className="text-ink">{sentTo}</strong>. Open it to finish creating your account.
        </p>
        <Link href="/login" className="btn-secondary mt-6 w-full">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Create your account</h2>
        <p className="mt-1.5 text-muted">Start inspecting roads with AI in minutes.</p>
      </div>

      {demoMode && <DemoModeNote />}

      <GoogleButton onClick={google} />
      <Divider text="or sign up with email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <input id="name" autoComplete="name" className="input" placeholder="Alex Rivera" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Work email" htmlFor="email">
            <input id="email" type="email" autoComplete="email" className="input" placeholder="you@city.gov" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <Field label="Organization or municipality" htmlFor="org">
          <input id="org" autoComplete="organization" className="input" placeholder="City of Austin Public Works" value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Your role</legend>
          <div className="grid grid-cols-3 gap-2">
            {roles.map(({ value, label, text, icon: Icon }) => {
              const active = role === value;
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border p-3 transition ${active ? "border-brand bg-brand-soft ring-2 ring-brand/20" : "border-line bg-surface hover:bg-surface-2"}`}
                >
                  <input type="radio" name="role" value={value} checked={active} onChange={() => setRole(value)} className="sr-only" />
                  <Icon className={`mb-1.5 h-5 w-5 ${active ? "text-brand" : "text-muted"}`} />
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 hidden text-xs leading-snug text-muted sm:block">{text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {password && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? strengthColor : "bg-line"}`} />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted">{strength}</span>
            </div>
            <ul className="grid grid-cols-2 gap-1 text-xs">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? "text-ok" : "text-muted"}`}>
                  <Check className={`h-3.5 w-3.5 ${c.ok ? "" : "opacity-30"}`} />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          {/* Terms and Privacy pages are not written yet. */}
          <span>I agree to the <span className="font-semibold text-ink">Terms</span> and <span className="font-semibold text-ink">Privacy Policy</span>.</span>
        </label>

        <button type="submit" disabled={busy || !canSubmit} className="btn-primary w-full py-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
