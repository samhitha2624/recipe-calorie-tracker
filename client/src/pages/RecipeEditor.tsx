import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { perServing, recipeTotals, rounded } from "../../../shared/nutrition";
import { api, type Food, type RecipeDetail } from "../api";
import { FoodPicker, PortionSelect } from "../components/FoodPicker";
import { ErrorText, MacroRow } from "../components/ui";

interface Row { key: number; food: Food; quantity: string; portionId: number | null; note: string }
let nextKey = 1;

export default function RecipeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ["recipe", id], queryFn: () => api<RecipeDetail>(`/recipes/${id}`), enabled: !!id });
  const [form, setForm] = useState({ name: "", description: "", servings: "2", instructions: "", imageUrl: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setForm({ name: r.name, description: r.description, servings: String(r.servings), instructions: r.instructions, imageUrl: r.imageUrl ?? "" });
    setRows(r.ingredients.map((i) => ({ key: nextKey++, food: i.food, quantity: String(i.quantity), portionId: i.portion?.id ?? null, note: i.note })));
  }, [existing.data]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const servings = Number(form.servings);
  const total = recipeTotals(
    rows.map((r) => ({
      food: r.food,
      quantity: Number(r.quantity) || 0,
      portionGrams: r.food.portions.find((p) => p.id === r.portionId)?.gramWeight ?? null,
    })),
  );
  const serving = rounded(servings > 0 ? perServing(total, servings) : total);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        servings,
        imageUrl: form.imageUrl || null,
        ingredients: rows.map((r) => ({ foodId: r.food.id, quantity: Number(r.quantity), portionId: r.portionId, note: r.note })),
      };
      const res = await api<{ id: number }>(id ? `/recipes/${id}` : "/recipes", { method: id ? "PUT" : "POST", body });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe", String(res.id)] });
      navigate(`/recipes/${res.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (id && existing.error) return <ErrorText error={existing.error} />;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div>
          <Link to={id ? `/recipes/${id}` : "/recipes"} className="text-sm text-emerald-700">← Back</Link>
          <h1 className="text-2xl font-semibold">{id ? "Edit recipe" : "New recipe"}</h1>
        </div>
        <div className="card space-y-3">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="description">Short description</label>
            <input id="description" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div>
              <label className="label" htmlFor="servings">Servings</label>
              <input id="servings" className="input" type="number" min="0.5" step="0.5" required value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="image">Photo URL (optional)</label>
              <input id="image" className="input" type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">Ingredients</h2>
          {rows.length === 0 && <p className="text-sm text-stone-500">Search for a food below to add it.</p>}
          {rows.map((r) => (
            <div key={r.key} className="grid items-end gap-2 border-b border-stone-100 pb-3 sm:grid-cols-[1fr_90px_170px_auto]">
              <div>
                <div className="text-sm font-medium">{r.food.name}</div>
                <input className="input mt-1" placeholder="note, e.g. diced" value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} />
              </div>
              <input className="input" type="number" min="0" step="any" aria-label="Quantity" required value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} />
              <PortionSelect food={r.food} value={r.portionId} onChange={(portionId) => update(r.key, { portionId })} />
              <button type="button" className="btn-secondary px-3" aria-label="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                ✕
              </button>
            </div>
          ))}
          <FoodPicker
            onPick={(food) =>
              setRows((rs) => [...rs, { key: nextKey++, food, quantity: food.portions.length ? "1" : "100", portionId: food.portions[0]?.id ?? null, note: "" }])
            }
          />
        </div>

        <div className="card">
          <label className="label" htmlFor="instructions">Steps</label>
          <textarea id="instructions" className="input" rows={6} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="card space-y-3">
          <div className="text-center">
            <div className="text-4xl font-bold text-emerald-800">{serving.kcal}</div>
            <div className="text-sm text-stone-500">kcal per serving</div>
            <div className="text-xs text-stone-400">{Math.round(total.kcal)} kcal for the whole recipe</div>
          </div>
          <MacroRow n={serving} />
        </div>
        <ErrorText error={error} />
        <button className="btn w-full" disabled={saving || rows.length === 0}>{saving ? "Saving…" : "Save recipe"}</button>
      </aside>
    </form>
  );
}
