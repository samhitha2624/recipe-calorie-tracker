import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFood, deleteFood, getFood, updateFood } from "../api";
import { useConfirm, useToast } from "../components/feedback";
import { ErrorText, Loading, usePageTitle } from "../components/ui";
import { foodKind } from "./FoodsPage";

interface PortionRow { key: number; id?: string; label: string; gramWeight: string }
let nextKey = 1;

const FIELDS = [
  ["kcal", "Calories"],
  ["proteinG", "Protein (g)"],
  ["carbsG", "Carbs (g)"],
  ["fatG", "Fat (g)"],
  ["fiberG", "Fiber (g)"],
] as const;
type Values = Record<(typeof FIELDS)[number][0] | "name", string>;

/** Create a food, or change any saved one: name, values per 100 g, and portion weights. */
export default function FoodEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  usePageTitle(id ? "Edit food" : "New food");
  const existing = useQuery({
    queryKey: ["food", id],
    queryFn: () => getFood(id!),
    enabled: !!id,
  });
  const [values, setValues] = useState<Values>({ name: "", kcal: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" });
  const [portions, setPortions] = useState<PortionRow[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const f = existing.data;
    if (!f) return;
    setValues({ name: f.name, kcal: String(f.kcal), proteinG: String(f.proteinG), carbsG: String(f.carbsG), fatG: String(f.fatG), fiberG: String(f.fiberG) });
    setPortions(f.portions.map((p) => ({ key: nextKey++, id: p.id, label: p.label, gramWeight: String(p.gramWeight) })));
  }, [existing.data]);

  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
  const update = (key: number, patch: Partial<PortionRow>) => setPortions((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: values.name,
        kcal: num(values.kcal),
        proteinG: num(values.proteinG),
        carbsG: num(values.carbsG),
        fatG: num(values.fatG),
        fiberG: num(values.fiberG),
        portions: portions.map((p) => ({ ...(p.id ? { id: p.id } : {}), label: p.label, gramWeight: Number(p.gramWeight) })),
      };
      const saved = id ? await updateFood(id, body) : await createFood(body);
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["food"] });
      qc.invalidateQueries({ queryKey: ["recipe"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast(`Saved ${saved.name}`);
      navigate("/foods");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete ${values.name}?`, message: "Days you already logged keep their calories.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await deleteFood(id!);
      qc.invalidateQueries({ queryKey: ["foods"] });
      toast(`Deleted ${values.name}`);
      navigate("/foods");
    } catch (err) {
      setError(err);
    }
  }

  if (id && existing.error) return <ErrorText error={existing.error} />;
  if (id && !existing.data) return <Loading label="Loading food" />;
  const f = existing.data;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <div>
        <Link to="/foods" className="text-sm text-emerald-700">← Foods</Link>
        <h1 className="text-2xl font-semibold">{id ? "Edit food" : "New food"}</h1>
        {f && (
          <p className="text-sm text-stone-500">
            {foodKind(f)} · used in {f.usedInRecipes} recipe{f.usedInRecipes === 1 ? "" : "s"}. Changes apply to those recipes; days you already logged keep their calories.
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </div>
        <p className="text-sm font-medium">Per 100 g</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="text-xs text-stone-600">
              {label}
              <input className="input mt-1" type="number" min="0" step="any" required={key === "kcal"} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">Portions</h2>
          <p className="text-xs text-stone-500">How much one unit weighs, e.g. "1 cup" = 244 g. Pasted recipes use these for cups, spoons and pieces.</p>
        </div>
        {portions.map((p) => (
          <div key={p.key} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
            <input className="input" aria-label="Portion name" placeholder="1 cup" required value={p.label} onChange={(e) => update(p.key, { label: e.target.value })} />
            <label className="flex items-center gap-1 text-sm text-stone-600">
              <input className="input" type="number" min="0.1" step="any" aria-label="Grams" required value={p.gramWeight} onChange={(e) => update(p.key, { gramWeight: e.target.value })} />
              g
            </label>
            <button type="button" className="btn-secondary px-3" aria-label="Remove portion" onClick={() => setPortions((ps) => ps.filter((x) => x.key !== p.key))}>✕</button>
          </div>
        ))}
        <button type="button" className="text-sm text-emerald-700 underline" onClick={() => setPortions((ps) => [...ps, { key: nextKey++, label: "", gramWeight: "" }])}>
          Add a portion
        </button>
      </div>

      <ErrorText error={error} />
      <div className="flex gap-2">
        <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        {f && (
          <button type="button" className="btn-secondary text-red-700" onClick={remove} disabled={f.usedInRecipes > 0} title={f.usedInRecipes ? "Used in a recipe" : undefined}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
