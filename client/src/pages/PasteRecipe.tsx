import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { add, perServing, rounded, ZERO } from "../../../shared/nutrition";
import { MEALS, parseIngredientText, saveRecipe, type Meal, type ParsedLine } from "../api";
import { useDebounced } from "../components/FoodPicker";
import { useToast } from "../components/feedback";
import { ErrorText, MacroRow, usePageTitle } from "../components/ui";

const EXAMPLE = `2 cups milk
1 cup poha
1 onion, chopped
2 green chillies
1 tbsp oil
1/2 tsp mustard seeds
Salt to taste`;

const parse = parseIngredientText;

/** Type the ingredients and steps as plain text; each line is matched to a food and the recipe is saved in one go. */
export default function PasteRecipe() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  usePageTitle("Paste a recipe");
  const [form, setForm] = useState({ name: "", meal: "" as Meal | "", servings: "2", ingredients: "", steps: "" });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const text = useDebounced(form.ingredients, 400);
  const preview = useQuery({ queryKey: ["parse", text], queryFn: () => parse(text), enabled: text.trim().length > 0 });

  const lines = text.trim() ? (preview.data ?? []) : [];
  const ok = lines.filter((l) => l.status === "ok");
  const problems = lines.filter((l) => l.status === "unknown" || l.status === "error");
  const servings = Number(form.servings);
  const total = ok.map((l) => l.nutrients).reduce(add, ZERO);
  const serving = rounded(servings > 0 ? perServing(total, servings) : total);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Parse the latest text, not the debounced preview, so nothing typed in the last moment is lost.
      const fresh = (await parse(form.ingredients)).filter((l) => l.status === "ok");
      if (!fresh.length) throw new Error("None of the ingredient lines were recognised.");
      const id = await saveRecipe(null, {
          name: form.name,
          meal: form.meal || null,
          servings,
          instructions: form.steps,
        ingredients: fresh.map((l) => ({ foodId: l.food.id, quantity: l.quantity, portionId: l.portionId, note: l.note.slice(0, 120) })),
      });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast(`Saved ${form.name} with ${fresh.length} ingredient${fresh.length === 1 ? "" : "s"}`);
      navigate(`/recipes/${id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div>
          <Link to="/recipes" className="text-sm text-emerald-700">← Back</Link>
          <h1 className="text-2xl font-semibold">Paste a recipe</h1>
          <p className="text-sm text-stone-500">Write one ingredient per line, like "2 cups milk" or "Onion - 1". Calories are worked out as you type.</p>
        </div>

        <div className="card grid gap-3 sm:grid-cols-[1fr_140px_100px]">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
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
        </div>

        <div className="card space-y-3">
          <label className="label" htmlFor="ingredients">Ingredients</label>
          <textarea
            id="ingredients"
            className="input font-mono"
            rows={8}
            placeholder={EXAMPLE}
            required
            value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
          />
          {preview.error && <ErrorText error={preview.error} />}
          {lines.length > 0 && (
            <ul className="divide-y divide-stone-100 text-sm">
              {lines.map((l, i) => (
                <LineRow key={i} l={l} />
              ))}
            </ul>
          )}
          {problems.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {problems.length === 1 ? "1 line isn't" : `${problems.length} lines aren't`} counted. Fix the wording, give the amount in grams, or{" "}
              <Link to="/recipes/new" className="underline">add your own food</Link> with that name.
            </p>
          )}
        </div>

        <div className="card">
          <label className="label" htmlFor="steps">Steps</label>
          <textarea
            id="steps"
            className="input"
            rows={6}
            placeholder={"1. Rinse the poha and drain.\n2. Heat oil, add mustard seeds, onion and chillies.\n3. Add poha and salt, mix and serve."}
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
          />
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
        <button className="btn w-full" disabled={saving || ok.length === 0}>
          {saving ? "Saving…" : problems.length ? `Save without ${problems.length} line${problems.length === 1 ? "" : "s"}` : "Save recipe"}
        </button>
      </aside>
    </form>
  );
}

function LineRow({ l }: { l: ParsedLine }) {
  if (l.status === "ok") {
    const portion = l.food.portions.find((p) => p.id === l.portionId);
    return (
      <li className="flex justify-between gap-3 py-1.5">
        <span>
          <span className="text-emerald-700">✓</span> {l.food.name}
          <span className="text-stone-500">
            {" · "}
            {portion ? `${l.quantity} × ${portion.label.replace(/^1 /, "")} (${Math.round(l.grams)} g)` : `${l.quantity} g`}
            {l.note && `, ${l.note}`}
          </span>
        </span>
        <span className="shrink-0 font-medium">{l.nutrients.kcal} kcal</span>
      </li>
    );
  }
  if (l.status === "skipped") {
    return (
      <li className="flex justify-between gap-3 py-1.5 text-stone-400">
        <span>– {l.line}</span>
        <span className="shrink-0">no amount, not counted</span>
      </li>
    );
  }
  return (
    <li className="flex justify-between gap-3 py-1.5 text-amber-800">
      <span>! {l.line}</span>
      <span className="shrink-0 text-right">{l.message}</span>
    </li>
  );
}
