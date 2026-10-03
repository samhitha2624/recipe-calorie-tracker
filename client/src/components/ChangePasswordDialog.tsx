import { useEffect, useRef, useState, type FormEvent } from "react";
import { changePassword, friendlyError, MIN_PASSWORD } from "../firebase";

/** Asks for the current password and a new one. */
export function ChangePasswordDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => ref.current?.showModal(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the new password.`);
    if (form.next !== form.confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      onChanged();
    } catch (err) {
      setError(friendlyError(err).replace("Wrong username or password.", "Your current password isn't right."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="w-[min(28rem,calc(100%-2rem))] rounded-xl border border-stone-200 bg-white p-0 shadow-xl backdrop:bg-stone-900/40"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        <h2 className="text-lg font-semibold">Change password</h2>
        {(
          [
            ["current", "Current password", "current-password"],
            ["next", "New password", "new-password"],
            ["confirm", "Confirm new password", "new-password"],
          ] as const
        ).map(([key, label, autoComplete], i) => (
          <label key={key} className="block text-sm font-medium text-stone-700">
            {label}
            <input
              className="input mt-1"
              type="password"
              autoComplete={autoComplete}
              autoFocus={i === 0}
              required
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </div>
      </form>
    </dialog>
  );
}
