import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Food, type UsdaHit } from "../api";
import { ErrorText } from "./ui";

interface SearchResult { custom: Food[]; usda: UsdaHit[]; usdaError?: string | null }

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search USDA FoodData Central and custom foods; resolves to a saved local food. */
export function FoodPicker({ onPick }: { onPick: (food: Food) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const term = useDebounced(q.trim(), 350);
  const search = useQuery({
    queryKey: ["food-search", term],
    queryFn: () => api<SearchResult>(`/foods/search?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
  });

  async function pickUsda(hit: UsdaHit) {
    setBusy(hit.fdcId);
    setError(null);
    try {
      onPick(await api<Food>("/foods/import", { body: { fdcId: hit.fdcId } }));
      setQ("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (creating) {
    return (
      <CustomFoodForm
        initialName={q}
        onCancel={() => setCreating(false)}
        onSaved={(f) => {
          setCreating(false);
          setQ("");
          onPick(f);
        }}
      />
    );
  }

  const data = term.length >= 2 ? search.data : undefined;
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Search foods, e.g. egg, rolled oats, banana" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorText error={error || search.error} />
      {search.isFetching && <p className="text-xs text-stone-500">Searching…</p>}
      {data && (
        <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200 bg-white">
          {data.custom.map((f) => (
            <li key={`c${f.id}`}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50" onClick={() => onPick(f)}>
                <span>{f.name} <span className="text-xs text-stone-400">custom</span></span>
                <span className="shrink-0 text-stone-500">{Math.round(f.kcal)} kcal/100 g</span>
              </button>
            </li>
          ))}
          {data.usda.map((h) => (
            <li key={h.fdcId}>
              <button
                type="button"
                disabled={busy !== null}
                className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 disabled:opacity-50"
                onClick={() => pickUsda(h)}
              >
                <span>
                  {h.name}
                  {h.brand && <span className="text-stone-500"> · {h.brand}</span>}
                  <span className="ml-1 text-xs text-stone-400">{h.dataType}</span>
                </span>
                <span className="shrink-0 text-stone-500">{busy === h.fdcId ? "Adding…" : h.kcalPer100g != null ? `${Math.round(h.kcalPer100g)} kcal/100 g` : ""}</span>
              </button>
            </li>
          ))}
          {data.usdaError && <li className="px-3 py-2 text-sm text-amber-700">{data.usdaError}</li>}
          {!data.custom.length && !data.usda.length && !data.usdaError && <li className="px-3 py-2 text-sm text-stone-500">No matches.</li>}
        </ul>
      )}
      <button type="button" className="text-sm text-emerald-700 underline" onClick={() => setCreating(true)}>
        Can't find it? Add your own food
      </button>
    </div>
  );
}

function CustomFoodForm({ initialName, onSaved, onCancel }: { initialName: string; onSaved: (f: Food) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: initialName, kcal: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" });
  const [error, setError] = useState<unknown>(null);
  const fields: [keyof typeof f, string][] = [
    ["kcal", "Calories"],
    ["proteinG", "Protein (g)"],
    ["carbsG", "Carbs (g)"],
    ["fatG", "Fat (g)"],
    ["fiberG", "Fiber (g)"],
  ];
  async function save() {
    setError(null);
    try {
      const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
      const food = await api<Food>("/foods", {
        body: { name: f.name, kcal: num(f.kcal), proteinG: num(f.proteinG), carbsG: num(f.carbsG), fatG: num(f.fatG), fiberG: num(f.fiberG) },
      });
      onSaved(food);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-sm font-medium">New food (values per 100 g, from the label)</p>
      <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {fields.map(([key, label]) => (
          <label key={key} className="text-xs text-stone-600">
            {label}
            <input className="input mt-1" type="number" min="0" step="any" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={save}>Save food</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function PortionSelect({ food, value, onChange }: { food: Food; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">grams</option>
      {food.portions.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label} ({Math.round(p.gramWeight)} g)
        </option>
      ))}
    </select>
  );
}
