import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listFoods, type Food } from "../api";
import { useDebounced } from "../components/FoodPicker";
import { EmptyState, ErrorText, Loading, usePageTitle } from "../components/ui";

const KINDS = [
  { id: "", label: "All" },
  { id: "kitchen", label: "Kitchen items" },
  { id: "custom", label: "My foods" },
  { id: "usda", label: "Saved from USDA" },
] as const;

export const foodKind = (f: Food) => ({ kitchen: "kitchen", custom: "mine", usda: "USDA" })[f.kind];

/** Every saved food, so you can correct calories, macros and portion weights. */
export default function FoodsPage() {
  usePageTitle("Foods");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("");
  const term = useDebounced(q.trim(), 250);
  const all = useQuery({ queryKey: ["foods"], queryFn: listFoods });
  const text = term.toLowerCase();
  const foods = {
    ...all,
    data: all.data?.filter((f) => (!kind || f.kind === kind) && (!text || f.name.toLowerCase().includes(text))),
  };
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-emerald-700 text-white" : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Foods</h1>
        <Link to="/foods/new" className="btn">New food</Link>
      </div>
      <p className="text-sm text-stone-500">Values are per 100 g. Click a food to change it; recipes using it update straight away.</p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.id} className={tab(kind === k.id)} onClick={() => setKind(k.id)}>{k.label}</button>
        ))}
        <input className="input max-w-xs" placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorText error={foods.error} />
      {foods.isLoading && <Loading label="Loading foods" />}
      {foods.data?.length === 0 && (
        <EmptyState title={q ? `No foods match "${q}"` : "No foods here yet"}>
          Foods you add, and USDA foods you pick in a recipe, show up here. <Link to="/foods/new" className="text-emerald-700 underline">Add a food</Link>
        </EmptyState>
      )}
      {!!foods.data?.length && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2">Food</th>
                <th className="px-2 py-2 text-right">kcal</th>
                <th className="px-2 py-2 text-right">Protein</th>
                <th className="px-2 py-2 text-right">Carbs</th>
                <th className="px-2 py-2 text-right">Fat</th>
                <th className="px-4 py-2">Portions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {foods.data.map((f) => (
                <tr key={f.id} className="hover:bg-emerald-50">
                  <td className="px-4 py-2">
                    <Link to={`/foods/${f.id}`} className="font-medium text-emerald-800 hover:underline">{f.name}</Link>
                    <span className="ml-2 text-xs text-stone-400">{foodKind(f)}</span>
                  </td>
                  <td className="px-2 py-2 text-right">{Math.round(f.kcal)}</td>
                  <td className="px-2 py-2 text-right">{f.proteinG}</td>
                  <td className="px-2 py-2 text-right">{f.carbsG}</td>
                  <td className="px-2 py-2 text-right">{f.fatG}</td>
                  <td className="px-4 py-2 text-xs text-stone-500">{f.portions.map((p) => `${p.label.replace(/^1 /, "")} ${Math.round(p.gramWeight)} g`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
