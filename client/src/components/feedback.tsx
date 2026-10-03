// Toast messages and dialogs, so pages can say "Saved" or ask "Delete this?" without browser pop-ups.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Toast {
  id: number;
  text: string;
  tone: "success" | "error";
  action?: { label: string; to: string };
}
type Notify = (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button, for deleting. */
  danger?: boolean;
  /** Show a text box; the dialog then resolves to its trimmed value. */
  input?: { label: string; initial?: string };
}
type Ask = (opts: DialogOptions) => Promise<string | boolean | null>;

const FeedbackContext = createContext<{ notify: Notify; ask: Ask }>({ notify: () => {}, ask: async () => null });

let nextId = 1;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(DialogOptions & { id: number; resolve: (v: string | boolean | null) => void }) | null>(null);

  const notify = useCallback<Notify>((text, opts = {}) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, text, tone: opts.tone ?? "success", action: opts.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.action ? 6000 : 3500);
  }, []);
  const ask = useCallback<Ask>((opts) => new Promise((resolve) => setDialog({ ...opts, id: nextId++, resolve })), []);

  return (
    <FeedbackContext.Provider value={{ notify, ask }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
              t.tone === "error" ? "bg-red-700 text-white" : "bg-stone-900 text-white"
            }`}
          >
            <span>{t.text}</span>
            {t.action && (
              <Link to={t.action.to} className="font-semibold text-emerald-300 underline-offset-2 hover:underline">
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
      {dialog && (
        <Dialog
          key={dialog.id}
          {...dialog}
          onClose={(v) => {
            dialog.resolve(v);
            setDialog(null);
          }}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function Dialog({ title, message, confirmLabel = "OK", danger, input, onClose }: DialogOptions & { onClose: (v: string | boolean | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(input?.initial ?? "");
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      className="w-[min(28rem,calc(100%-2rem))] rounded-xl border border-stone-200 bg-white p-0 shadow-xl backdrop:bg-stone-900/40"
      onCancel={(e) => {
        e.preventDefault();
        onClose(null);
      }}
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (input && !value.trim()) return;
          onClose(input ? value.trim() : true);
        }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {message && <p className="text-sm text-stone-600">{message}</p>}
        {input && (
          <label className="block text-sm font-medium text-stone-700">
            {input.label}
            <input className="input mt-1" autoFocus required value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => onClose(null)}>Cancel</button>
          <button className={danger ? "btn bg-red-700 hover:bg-red-800" : "btn"} autoFocus={!input}>{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

/** Shows a short message at the bottom of the screen. */
export const useToast = () => useContext(FeedbackContext).notify;

/** Asks a yes/no question; resolves to true when confirmed. */
export function useConfirm() {
  const { ask } = useContext(FeedbackContext);
  return useCallback((opts: Omit<DialogOptions, "input">) => ask(opts).then((v) => v === true), [ask]);
}

/** Asks for one line of text; resolves to it, or null when cancelled. */
export function usePrompt() {
  const { ask } = useContext(FeedbackContext);
  return useCallback(
    (opts: Omit<DialogOptions, "input"> & { label: string; initial?: string }) =>
      ask({ ...opts, input: { label: opts.label, initial: opts.initial } }).then((v) => (typeof v === "string" ? v : null)),
    [ask],
  );
}
