import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, MEALS, mealLabel, type Meal, type RecipeSummary } from "../api";
import { EmptyState, ErrorText, Loading, RatingLine, usePageTitle } from "../components/ui";

export default function RecipesPage() {
  usePageTitle("Recipes");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [meal, setMeal] = useState<Meal | "all">("all");
  const recipes = useQuery({ queryKey: ["recipes", q, sort, meal], queryFn: () => listRecipes({ q, sort, meal: meal === "all" ? undefined : meal }) });

  // On "All", show one section per meal, plus recipes that don't have one yet.
  const sections =
    meal === "all"
      ? [...MEALS.map((m) => m.id), null].map((id) => ({ id, recipes: recipes.data?.filter((r) => r.meal === id) ?? [] })).filter((s) => s.recipes.length)
      : [{ id: meal, recipes: recipes.data ?? [] }];
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-emerald-700 text-white" : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Recipes</h1>
        <Link to="/recipes/paste" className="btn-secondary">Paste a recipe</Link>
        <Link to="/recipes/new" className="btn">New recipe</Link>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        <button role="tab" aria-selected={meal === "all"} className={tab(meal === "all")} onClick={() => setMeal("all")}>All</button>
        {MEALS.map((m) => (
          <button key={m.id} role="tab" aria-selected={meal === m.id} className={tab(meal === m.id)} onClick={() => setMeal(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "new" | "top")}>
          <option value="new">Newest</option>
          <option value="top">Top rated</option>
        </select>
      </div>
      <ErrorText error={recipes.error} />
      {recipes.isLoading && <Loading label="Loading recipes" />}
      {recipes.data?.length === 0 &&
        (q ? (
          <EmptyState title={`No recipes match "${q}"`}>Try a different word, or clear the search.</EmptyState>
        ) : (
          <EmptyState title={`No ${meal === "all" ? "" : `${mealLabel(meal).toLowerCase()} `}recipes yet`}>
            <p>Type the ingredients and steps and the calories are worked out for you.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/recipes/paste" className="btn">Paste a recipe</Link>
              <Link to="/recipes/new" className="btn-secondary">Build one step by step</Link>
            </div>
          </EmptyState>
        ))}
      {sections.map((s) => (
        <section key={s.id ?? "other"} className="space-y-3">
          {meal === "all" && <h2 className="pt-2 text-lg font-semibold text-stone-800">{mealLabel(s.id)}</h2>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.recipes.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecipeCard({ r }: { r: RecipeSummary }) {
  return (
    <Link to={`/recipes/${r.id}`} className="card flex flex-col gap-2 transition hover:border-emerald-400">
      {r.imageUrl && <img src={r.imageUrl} alt="" className="h-36 w-full rounded-md object-cover" />}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{r.name}</h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-800">{r.perServing.kcal} kcal</span>
      </div>
      {r.description && <p className="line-clamp-2 text-sm text-stone-600">{r.description}</p>}
      <p className="text-xs text-stone-500">
        per serving · {r.perServing.proteinG} g protein · {r.perServing.carbsG} g carbs · {r.perServing.fatG} g fat
      </p>
      <div className="mt-auto pt-1">
        <RatingLine rating={r.rating} />
      </div>
    </Link>
  );
}
