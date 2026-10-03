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
  if (!rating.count) return <span className="text-xs text-stone-400">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-stone-600">
      <Stars value={rating.average ?? 0} size="text-sm" />
      {rating.average?.toFixed(1)} ({rating.count})
    </span>
  );
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
  return <p className="text-sm text-red-700">{(error as Error).message}</p>;
}
