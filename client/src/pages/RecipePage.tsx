import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRecipe, getRecipe, logRecipe, MEALS, mealLabel, rateRecipe, today, type Meal, type RecipeDetail } from "../api";
import { useConfirm, useToast } from "../components/feedback";
import { ErrorText, Loading, MacroRow, RatingLine, Stars, usePageTitle } from "../components/ui";

export default function RecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id!) });
  usePageTitle(recipe.data?.name);
  const remove = useMutation({
    mutationFn: () => deleteRecipe(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast(`Deleted ${recipe.data?.name ?? "recipe"}`);
      navigate("/recipes");
    },
    onError: (e) => toast((e as Error).message, { tone: "error" }),
  });

  if (recipe.error) return <ErrorText error={recipe.error} />;
  const r = recipe.data;
  if (!r) return <Loading label="Loading recipe" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Link to="/recipes" className="text-sm text-emerald-700">← All recipes</Link>
          <h1 className="text-2xl font-semibold">{r.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            {r.meal && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{mealLabel(r.meal)}</span>}
            <span>{r.servings} servings</span>
            <RatingLine rating={r.rating} />
          </div>
          {r.description && <p className="text-stone-700">{r.description}</p>}
          {r.imageUrl && <img src={r.imageUrl} alt="" className="max-h-80 w-full rounded-lg object-cover" />}
          <div className="flex gap-2">
            <Link to={`/recipes/${r.id}/edit`} className="btn-secondary">Edit</Link>
            <button
              className="btn-secondary text-red-700"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${r.name}?`,
                  message: "The recipe and its rating are removed. Days you already logged keep their calories.",
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (ok) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              Delete
            </button>
          </div>
        </div>

        <section className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold">Ingredients and calories</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="pb-2">Ingredient</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2 text-right">kcal</th>
                <th className="pb-2 text-right">Protein</th>
                <th className="pb-2 text-right">Carbs</th>
                <th className="pb-2 text-right">Fat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.ingredients.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-2">
                    {i.food.name}
                    {i.note && <span className="text-stone-500">, {i.note}</span>}
                  </td>
                  <td className="py-2 pr-2 text-stone-600">
                    {i.portion ? `${i.quantity} × ${i.portion.label}` : `${i.quantity} g`}
                    {i.portion && <span className="text-xs text-stone-400"> ({Math.round(i.grams)} g)</span>}
                  </td>
                  <td className="py-2 text-right font-medium">{i.nutrients.kcal}</td>
                  <td className="py-2 text-right">{i.nutrients.proteinG}</td>
                  <td className="py-2 text-right">{i.nutrients.carbsG}</td>
                  <td className="py-2 text-right">{i.nutrients.fatG}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-2" colSpan={2}>Whole recipe</td>
                <td className="pt-2 text-right">{r.total.kcal}</td>
                <td className="pt-2 text-right">{r.total.proteinG}</td>
                <td className="pt-2 text-right">{r.total.carbsG}</td>
                <td className="pt-2 text-right">{r.total.fatG}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-stone-400">Macros in grams. Values come from USDA FoodData Central, the built-in kitchen list, or foods you entered; change any of them on the Foods page.</p>
        </section>

        {r.instructions && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Steps</h2>
            <p className="whitespace-pre-wrap text-sm text-stone-700">{r.instructions}</p>
          </section>
        )}

        <section className="card space-y-3">
          <h2 className="font-semibold">My rating</h2>
          <ReviewForm recipeId={r.id} existing={r.myReview ?? undefined} />
        </section>
      </div>

      <aside className="space-y-4">
        <div className="card space-y-3">
          <div className="text-center">
            <div className="text-4xl font-bold text-emerald-800">{r.perServing.kcal}</div>
            <div className="text-sm text-stone-500">kcal per serving</div>
          </div>
          <MacroRow n={r.perServing} />
        </div>
        <LogRecipeForm recipe={r} />
      </aside>
    </div>
  );
}

function ReviewForm({ recipeId, existing }: { recipeId: string; existing?: { rating: number; comment: string; updatedAt: number } }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const save = useMutation({
    mutationFn: () => rateRecipe(recipeId, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", recipeId] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast("Rating saved");
    },
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        <span>{existing ? `Rated on ${new Date(existing.updatedAt).toLocaleDateString()}` : "How was it?"}</span>
        <Stars value={rating} onChange={setRating} size="text-xl" />
      </div>
      <textarea
        className="input"
        rows={2}
        placeholder="Notes for next time: what to change, how it tasted"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <ErrorText error={save.error} />
      <button className="btn" disabled={!rating || save.isPending}>{existing ? "Update" : "Save rating"}</button>
    </form>
  );
}

function LogRecipeForm({ recipe }: { recipe: RecipeDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [servings, setServings] = useState("1");
  const [meal, setMeal] = useState<Meal>(recipe.meal ?? "lunch");
  const [date, setDate] = useState(today());
  const log = useMutation({
    mutationFn: () => logRecipe({ date, meal, recipeId: recipe.id, servings: Number(servings) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      toast(`Logged ${kcal} kcal to ${mealLabel(meal)}${date === today() ? "" : ` on ${date}`}`, { action: { label: "See day", to: "/tracker" } });
    },
  });
  const kcal = Math.round(recipe.perServing.kcal * (Number(servings) || 0));
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        log.mutate();
      }}
    >
      <h2 className="font-semibold">Add to my day</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-600">
          Servings
          <input className="input mt-1" type="number" min="0.25" step="0.25" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
        <label className="text-xs text-stone-600">
          Meal
          <select className="input mt-1" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-stone-600">
        Day
        <input className="input mt-1" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <ErrorText error={log.error} />
      <button className="btn w-full" disabled={!(Number(servings) > 0) || log.isPending}>Log {kcal} kcal</button>
    </form>
  );
}
