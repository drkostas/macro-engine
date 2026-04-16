"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function LoginForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (r.ok) {
      router.push(search.get("next") || "/dashboard");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-base p-6">
      <form onSubmit={submit} className="bg-surface-elevated border border-border-glow rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h1 className="t-headline text-text">MacroEngine</h1>
        <p className="t-caption text-text-muted">Enter the shared password to continue.</p>
        <input
          type="password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-base border border-border-subtle rounded-lg px-3 py-2 text-text"
          placeholder="Password"
        />
        {error && <p className="t-caption text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-teal text-base py-2.5 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
