import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { ErrorText, Loading, usePageTitle } from "../components/ui";
import { createLogin, friendlyError, isSetUp, MIN_PASSWORD, signIn, USERNAME_PATTERN } from "../firebase";

/**
 * The first time the app opens it asks you to create its one login; after that it only offers sign-in.
 */
export default function AuthPage() {
  const setup = useQuery({ queryKey: ["is-set-up"], queryFn: isSetUp, staleTime: Infinity });
  usePageTitle(setup.data === false ? "Create your login" : "Sign in");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-stone-50 px-4">
      <div className="card w-full max-w-sm space-y-5 p-8">
        <div className="space-y-3 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="text-2xl font-semibold text-stone-900">Recipe Calories</h1>
        </div>
        {setup.isLoading && <Loading label="Connecting" />}
        {setup.error && (
          <ErrorText
            error={
              new Error(
                (setup.error as { code?: string }).code === "permission-denied"
                  ? "The app can't read its database yet. In the Firebase console, create the Firestore database and publish the rules from firestore.rules."
                  : friendlyError(setup.error),
              )
            }
          />
        )}
        {setup.data === true && <SignInForm />}
        {setup.data === false && <CreateLoginForm />}
      </div>
    </div>
  );
}

function SignInForm() {
  const { run, error: authError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await run(() => signIn(username, password));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-center text-sm text-stone-500">Sign in to your recipes and daily food log.</p>
      <label className="block text-sm font-medium text-stone-700">
        Username
        <input className="input mt-1" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Password
        <input className="input mt-1" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {(error || authError) && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error ?? authError}</p>}
      <button className="btn w-full py-2.5" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-xs text-stone-400">Forgot your password? Reset it in the Firebase console under Authentication → Users.</p>
    </form>
  );
}

function CreateLoginForm() {
  const { run } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ username: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const username = form.username.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!USERNAME_PATTERN.test(username)) return setError("Usernames are 3 to 30 characters: lowercase letters, numbers, dots, dashes or underscores.");
    if (form.password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the password.`);
    if (form.password !== form.confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await run(() => createLogin(username, form.password));
    } catch (err) {
      setError(friendlyError(err));
      // Someone may have finished setting up meanwhile; show sign-in if so.
      qc.invalidateQueries({ queryKey: ["is-set-up"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <p className="font-medium">Welcome! Create your login.</p>
        <p className="mt-1 text-emerald-800">This app has one user. Once you've made this login, nobody else can create one.</p>
      </div>
      <label className="block text-sm font-medium text-stone-700">
        Username
        <input className="input mt-1" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <span className="mt-1 block text-xs font-normal text-stone-500">Lowercase letters, numbers, dots, dashes or underscores.</span>
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Password
        <input className="input mt-1" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <span className="mt-1 block text-xs font-normal text-stone-500">At least {MIN_PASSWORD} characters.</span>
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Confirm password
        <input className="input mt-1" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </label>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
      <button className="btn w-full py-2.5" disabled={busy}>{busy ? "Creating…" : "Create login"}</button>
    </form>
  );
}
