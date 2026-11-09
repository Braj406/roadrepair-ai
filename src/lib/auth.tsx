"use client";

// Sign-in, sign-up and session state for the whole app, available through useAuth().
// Uses Supabase when keys are set; otherwise falls back to a browser-only demo mode.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, isDemoMode } from "./supabase";

export type Role = "admin" | "inspector" | "crew";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  organization: string;
  role: Role;
};

export type SignUpInput = {
  fullName: string;
  email: string;
  organization: string;
  role: Role;
  password: string;
};

type AuthResult = { error?: string; needsConfirmation?: boolean };

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInAsDemo: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ---- Demo mode (no Supabase keys) ----
// Accounts live in this browser's localStorage. Fine for a local demo, never for real users.
const USERS_KEY = "rr_demo_users";
const SESSION_KEY = "rr_demo_session";

type StoredUser = AppUser & { passwordHash: string };

const DEMO_USER: AppUser = {
  id: "demo-user",
  email: "demo@roadrepair.ai",
  fullName: "Demo Inspector",
  organization: "City of Austin Public Works",
  role: "admin",
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: session just won't persist */
  }
}

// Hash demo passwords so they aren't stored as plain text.
async function hash(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Our sign-up form saves name, organization and role in Supabase's user_metadata.
function fromSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AppUser {
  const m = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? "",
    fullName: (m.full_name as string) || (m.name as string) || (u.email ?? "").split("@")[0],
    organization: (m.organization as string) || "",
    role: ((m.role as Role) || "inspector"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session ? fromSupabaseUser(data.session.user) : null);
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session ? fromSupabaseUser(session.user) : null);
      });
      return () => sub.subscription.unsubscribe();
    }
    // Demo mode: read the saved session from browser storage after mount.
    Promise.resolve().then(() => {
      setUser(readJSON<AppUser | null>(SESSION_KEY, null));
      setLoading(false);
    });
  }, []);

  const startDemoSession = useCallback((u: AppUser) => {
    writeJSON(SESSION_KEY, u);
    setUser(u);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    }
    const users = readJSON<StoredUser[]>(USERS_KEY, []);
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found || found.passwordHash !== (await hash(password))) {
      return { error: "That email and password don't match an account." };
    }
    startDemoSession({ id: found.id, email: found.email, fullName: found.fullName, organization: found.organization, role: found.role });
    return {};
  }, [startDemoSession]);

  const signUp = useCallback(async (input: SignUpInput): Promise<AuthResult> => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.fullName, organization: input.organization, role: input.role },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) return { error: error.message };
      // No session yet means Supabase sent a confirmation email first.
      return { needsConfirmation: !data.session };
    }
    const users = readJSON<StoredUser[]>(USERS_KEY, []);
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      return { error: "An account with this email already exists." };
    }
    const appUser: AppUser = {
      id: crypto.randomUUID(),
      email: input.email,
      fullName: input.fullName,
      organization: input.organization,
      role: input.role,
    };
    writeJSON(USERS_KEY, [...users, { ...appUser, passwordHash: await hash(input.password) }]);
    startDemoSession(appUser);
    return {};
  }, [startDemoSession]);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      return error ? { error: error.message } : {};
    }
    return { error: "Google sign-in needs Supabase keys. Use the demo account for now." };
  }, []);

  // Shared sample account, only offered in demo mode.
  const signInAsDemo = useCallback(async (): Promise<AuthResult> => {
    startDemoSession(DEMO_USER);
    return {};
  }, [startDemoSession]);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      return error ? { error: error.message } : {};
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, demoMode: isDemoMode, signIn, signUp, signInWithGoogle, signInAsDemo, resetPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
