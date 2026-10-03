import { useEffect, type ReactNode } from "react";
import type { Nutrients } from "../../../shared/nutrition";
import type { Rating } from "../api";

export function Stars({ value, onChange, size = "text-base" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <span className={`inline-flex ${size}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <span className={filled ? "text-amber-500" : "text-stone-300"}>★</span>;
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`} className="px-0.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export function RatingLine({ rating }: { rating: Rating }) {
  if (!rating.count) return <span className="text-xs text-stone-400">Not rated</span>;
  return <Stars value={rating.average ?? 0} size="text-sm" />;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function MacroRow({ n }: { n: Nutrients }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        ["Protein", n.proteinG],
        ["Carbs", n.carbsG],
        ["Fat", n.fatG],
        ["Fiber", n.fiberG],
      ].map(([label, value]) => (
        <div key={label as string} className="rounded-md bg-stone-100 px-2 py-2">
          <div className="text-sm font-semibold">{fmt(value as number)} g</div>
          <div className="text-xs text-stone-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {(error as Error).message}
    </p>
  );
}

/** Sets the browser tab title for a page. */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Recipe Calories` : "Recipe Calories";
  }, [title]);
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-stone-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-600" />
      {label}…
    </div>
  );
}

/** A friendly box for "nothing here yet", with what to do next. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-500">{children}</div>}
    </div>
  );
}
