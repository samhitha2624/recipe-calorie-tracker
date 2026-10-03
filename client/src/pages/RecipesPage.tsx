import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type RecipeSummary } from "../api";
import { ErrorText, RatingLine } from "../components/ui";

export default function RecipesPage() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [mine, setMine] = useState(false);
  const params = new URLSearchParams({ q, sort, ...(mine ? { author: "me" } : {}) });
  const recipes = useQuery({ queryKey: ["recipes", q, sort, mine], queryFn: () => api<RecipeSummary[]>(`/recipes?${params}`) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <Link to="/recipes/new" className="btn ml-auto">New recipe</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "new" | "top")}>
          <option value="new">Newest</option>
          <option value="top">Top rated</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine
        </label>
      </div>
      <ErrorText error={recipes.error} />
      {recipes.data?.length === 0 && (
        <p className="text-stone-500">No recipes yet. <Link to="/recipes/new" className="text-emerald-700 underline">Add the first one</Link>.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.data?.map((r) => (
          <Link key={r.id} to={`/recipes/${r.id}`} className="card flex flex-col gap-2 transition hover:border-emerald-400">
            {r.imageUrl && <img src={r.imageUrl} alt="" className="h-36 w-full rounded-md object-cover" />}
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{r.name}</h2>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-800">{r.perServing.kcal} kcal</span>
            </div>
            {r.description && <p className="line-clamp-2 text-sm text-stone-600">{r.description}</p>}
            <p className="text-xs text-stone-500">
              per serving · {r.perServing.proteinG} g protein · {r.perServing.carbsG} g carbs · {r.perServing.fatG} g fat
            </p>
            <div className="mt-auto flex items-center justify-between pt-1">
              <RatingLine rating={r.rating} />
              <span className="text-xs text-stone-500">by {r.author.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
