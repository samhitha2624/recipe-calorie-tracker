import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, today, type Meal, type RecipeDetail } from "../api";
import { useAuth } from "../auth";
import { ErrorText, MacroRow, RatingLine, Stars } from "../components/ui";

export default function RecipePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => api<RecipeDetail>(`/recipes/${id}`) });
  const remove = useMutation({
    mutationFn: () => api(`/recipes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      navigate("/recipes");
    },
  });

  if (recipe.error) return <ErrorText error={recipe.error} />;
  const r = recipe.data;
  if (!r) return <p className="text-stone-500">Loading…</p>;
  const myReview = r.reviews.find((x) => x.user.id === user?.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Link to="/recipes" className="text-sm text-emerald-700">← All recipes</Link>
          <h1 className="text-2xl font-semibold">{r.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <span>by {r.author.name}</span>
            <span>{r.servings} servings</span>
            <RatingLine rating={r.rating} />
          </div>
          {r.description && <p className="text-stone-700">{r.description}</p>}
          {r.imageUrl && <img src={r.imageUrl} alt="" className="max-h-80 w-full rounded-lg object-cover" />}
          {r.canEdit && (
            <div className="flex gap-2">
              <Link to={`/recipes/${r.id}/edit`} className="btn-secondary">Edit</Link>
              <button
                className="btn-secondary text-red-700"
                onClick={() => confirm("Delete this recipe?") && remove.mutate()}
                disabled={remove.isPending}
              >
                Delete
              </button>
            </div>
          )}
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
          <p className="mt-2 text-xs text-stone-400">Macros in grams. Nutrition data from USDA FoodData Central unless marked custom.</p>
        </section>

        {r.instructions && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Steps</h2>
            <p className="whitespace-pre-wrap text-sm text-stone-700">{r.instructions}</p>
          </section>
        )}

        <section className="card space-y-4">
          <h2 className="font-semibold">Reviews</h2>
          {!r.canEdit && <ReviewForm recipeId={r.id} existing={myReview} />}
          {r.reviews.length === 0 && <p className="text-sm text-stone-500">No reviews yet.</p>}
          <ul className="space-y-3">
            {r.reviews.map((rev) => (
              <li key={rev.id} className="border-t border-stone-100 pt-3">
                <div className="flex items-center gap-2 text-sm">
                  <Stars value={rev.rating} size="text-sm" />
                  <span className="font-medium">{rev.user.name}</span>
                  <span className="text-xs text-stone-400">{new Date(rev.updatedAt).toLocaleDateString()}</span>
                </div>
                {rev.comment && <p className="mt-1 text-sm text-stone-700">{rev.comment}</p>}
              </li>
            ))}
          </ul>
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

function ReviewForm({ recipeId, existing }: { recipeId: number; existing?: { rating: number; comment: string } }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const save = useMutation({
    mutationFn: () => api(`/recipes/${recipeId}/review`, { method: "PUT", body: { rating, comment } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", String(recipeId)] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
  return (
    <form
      className="space-y-2 rounded-md bg-stone-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center gap-2 text-sm">
        <span>{existing ? "Your review" : "Rate this recipe"}</span>
        <Stars value={rating} onChange={setRating} size="text-xl" />
      </div>
      <textarea
        className="input"
        rows={2}
        placeholder="How did it taste? Do the calories match what you expected?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <ErrorText error={save.error} />
      <button className="btn" disabled={!rating || save.isPending}>{existing ? "Update review" : "Post review"}</button>
      {save.isSuccess && <span className="ml-2 text-sm text-emerald-700">Saved</span>}
    </form>
  );
}

function LogRecipeForm({ recipe }: { recipe: RecipeDetail }) {
  const qc = useQueryClient();
  const [servings, setServings] = useState("1");
  const [meal, setMeal] = useState<Meal>("lunch");
  const [date, setDate] = useState(today());
  const log = useMutation({
    mutationFn: () => api("/log", { body: { date, meal, recipeId: recipe.id, servings: Number(servings) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log"] }),
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
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>
      </div>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <ErrorText error={log.error} />
      <button className="btn w-full" disabled={!(Number(servings) > 0) || log.isPending}>Log {kcal} kcal</button>
      {log.isSuccess && (
        <p className="text-sm text-emerald-700">
          Logged. <Link className="underline" to="/tracker">See my day</Link>
        </p>
      )}
    </form>
  );
}
