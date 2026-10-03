import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type User } from "../api";
import { useAuth } from "../auth";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = signup ? form : { email: form.email, password: form.password };
      const user = await api<User>(`/auth/${mode}`, { body });
      setUser(user);
      navigate("/recipes");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-emerald-800">Recipe Calories</h1>
          <p className="text-sm text-stone-500">{signup ? "Create your account" : "Log in to your account"}</p>
        </div>
        {signup && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            className="input"
            required
            minLength={signup ? 8 : undefined}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {signup && <p className="mt-1 text-xs text-stone-500">At least 8 characters.</p>}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy}>{signup ? "Sign up" : "Log in"}</button>
        <p className="text-center text-sm text-stone-600">
          {signup ? (
            <>Already have an account? <Link className="text-emerald-700 underline" to="/login">Log in</Link></>
          ) : (
            <>New here? <Link className="text-emerald-700 underline" to="/signup">Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
