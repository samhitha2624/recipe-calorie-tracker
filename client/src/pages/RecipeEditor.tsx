import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { perServing, recipeTotals, rounded } from "../../../shared/nutrition";
import { getRecipe, MEALS, saveRecipe, type Food, type Meal } from "../api";
import { FoodPicker, PortionSelect } from "../components/FoodPicker";
import { useToast } from "../components/feedback";
import { ErrorText, Loading, MacroRow, usePageTitle } from "../components/ui";

interface Row { key: number; food: Food; quantity: string; portionId: string | null; note: string }
let nextKey = 1;

export default function RecipeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  usePageTitle(id ? "Edit recipe" : "New recipe");
  const existing = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id!), enabled: !!id });
  const [form, setForm] = useState({ name: "", meal: "" as Meal | "", description: "", servings: "2", instructions: "", imageUrl: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setForm({ name: r.name, meal: r.meal ?? "", description: r.description, servings: String(r.servings), instructions: r.instructions, imageUrl: r.imageUrl ?? "" });
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
        meal: form.meal || null,
        imageUrl: form.imageUrl || null,
        ingredients: rows.map((r) => ({ foodId: r.food.id, quantity: Number(r.quantity), portionId: r.portionId, note: r.note })),
      };
      const savedId = await saveRecipe(id ?? null, body);
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe", savedId] });
      toast(id ? "Recipe updated" : "Recipe saved");
      navigate(`/recipes/${savedId}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (id && existing.error) return <ErrorText error={existing.error} />;
  if (id && !existing.data) return <Loading label="Loading recipe" />;

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
          <div className="grid gap-3 sm:grid-cols-[140px_120px_1fr]">
            <div>
              <label className="label" htmlFor="meal">Meal</label>
              <select id="meal" className="input" required value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value as Meal })}>
                <option value="" disabled>Choose…</option>
                {MEALS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
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
