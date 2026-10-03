import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ingredientNutrients, rounded } from "../../../shared/nutrition";
import {
  deleteEntry,
  getDay,
  getSummary,
  listRecipes,
  logFood,
  logRecipe,
  MEALS,
  mealLabel,
  shiftDay,
  today,
  type DayLog,
  type DaySummary,
  type Food,
  type Goal,
  type LogEntry,
  type Meal,
  type RecipeSummary,
  setGoal,
  updateEntry,
} from "../api";
import { FoodPicker, PortionSelect, useDebounced } from "../components/FoodPicker";
import { useToast } from "../components/feedback";
import { ErrorText, Loading, MacroRow, usePageTitle } from "../components/ui";

/** The meal you're most likely logging right now. */
function mealForNow(): Meal {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner";
}

/** "Today", "Yesterday", "Tomorrow", or e.g. "Mon, 29 Sep". */
function dayLabel(day: string): string {
  if (day === today()) return "Today";
  if (day === today(-1)) return "Yesterday";
  if (day === today(1)) return "Tomorrow";
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function TrackerPage() {
  usePageTitle("My day");
  const [date, setDate] = useState(today());
  const qc = useQueryClient();
  const toast = useToast();
  const day = useQuery({ queryKey: ["log", date], queryFn: () => getDay(date) });
  const remove = useMutation({
    mutationFn: (e: LogEntry) => deleteEntry(e.id),
    onSuccess: (_, e) => {
      qc.invalidateQueries({ queryKey: ["log"] });
      toast(`Removed ${e.name}`);
    },
    onError: (err) => toast((err as Error).message, { tone: "error" }),
  });

  const d = day.data;
  const goal = d?.goal?.dailyKcal ?? null;
  const eaten = d?.total.kcal ?? 0;
  const pct = goal ? Math.min(100, (eaten / goal) * 100) : 0;
  const over = goal != null && eaten > goal;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold">{dayLabel(date)}</h1>
            {dayLabel(date) !== date && <p className="text-sm text-stone-500">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</p>}
          </div>
          <button className="btn-secondary px-3" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">←</button>
          <input className="input w-auto" type="date" aria-label="Pick a day" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-secondary px-3" onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day">→</button>
          {date !== today() && <button className="btn-secondary" onClick={() => setDate(today())}>Today</button>}
        </div>

        <div className="card space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{eaten} <span className="text-base font-normal text-stone-500">kcal eaten</span></div>
              {goal ? (
                <div className={`text-sm ${over ? "text-red-700" : "text-stone-600"}`}>
                  {over ? `${eaten - goal} kcal over your ${goal} kcal goal` : `${goal - eaten} kcal left of ${goal}`}
                </div>
              ) : (
                <div className="text-sm text-stone-500">Set a daily goal to see what's left.</div>
              )}
            </div>
          </div>
          {goal && (
            <div className="h-3 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={eaten} aria-valuemax={goal}>
              <div className={`h-full rounded-full ${over ? "bg-red-600" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {d && <MacroRow n={d.total} />}
        </div>

        <ErrorText error={day.error} />
        {day.isLoading && <Loading label="Loading your day" />}
        {MEALS.map((m) => {
          const entries = d?.entries.filter((e) => e.meal === m.id) ?? [];
          const kcal = Math.round(entries.reduce((s, e) => s + e.kcal, 0));
          return (
            <section key={m.id} className="card">
              <div className="mb-2 flex justify-between">
                <h2 className="font-semibold">{m.label}</h2>
                <span className="text-sm text-stone-500">{kcal} kcal</span>
              </div>
              {entries.length === 0 && <p className="text-sm text-stone-400">Nothing logged yet.</p>}
              <ul className="divide-y divide-stone-100">
                {entries.map((e) => (
                  <EntryRow key={e.id} e={e} onRemove={() => remove.mutate(e)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="space-y-4">
        <AddToDay date={date} />
        <GoalForm current={d?.goal ?? null} />
        <WeekChart end={date} />
      </aside>
    </div>
  );
}

const amountText = (e: LogEntry) =>
  e.recipeId != null || (e.foodId == null && !e.portion)
    ? `${e.quantity} serving${e.quantity === 1 ? "" : "s"}`
    : e.portion
      ? `${e.quantity} × ${e.portion.label}`
      : `${e.quantity} g`;

/** One logged item, with an edit form for name, amount, meal, date and calories. */
function EntryRow({ e, onRemove }: { e: LogEntry; onRemove: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", quantity: "", meal: e.meal, date: e.date, kcal: "" });
  const save = useMutation({
    mutationFn: () => {
      const quantity = Number(form.quantity);
      const kcal = Number(form.kcal);
      return updateEntry(e.id, {
          name: form.name,
          meal: form.meal,
          date: form.date,
          ...(quantity !== e.quantity ? { quantity } : {}),
          // Only send calories if you typed a new number; otherwise they follow the amount.
          ...(kcal !== Math.round(e.kcal) ? { kcal } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      setEditing(false);
      toast("Entry updated");
    },
  });

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 py-2 text-sm">
        <span>
          {e.name}
          <span className="text-stone-500"> · {amountText(e)}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-medium">{Math.round(e.kcal)} kcal</span>
          <button
            className="text-stone-400 hover:text-emerald-700"
            aria-label={`Edit ${e.name}`}
            onClick={() => {
              setForm({ name: e.name, quantity: String(e.quantity), meal: e.meal, date: e.date, kcal: String(Math.round(e.kcal)) });
              setEditing(true);
            }}
          >
            ✎
          </button>
          <button className="text-stone-400 hover:text-red-700" aria-label={`Remove ${e.name}`} onClick={onRemove}>✕</button>
        </span>
      </li>
    );
  }
  const unit = amountText(e).replace(/^[\d.]+\s*(× )?/, "");
  return (
    <li className="py-2">
      <form
        className="space-y-2 rounded-md bg-stone-50 p-3 text-sm"
        onSubmit={(ev) => {
          ev.preventDefault();
          save.mutate();
        }}
      >
        <input className="input" aria-label="Name" required value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="text-xs text-stone-600">
            Amount ({unit})
            <input className="input mt-1" type="number" min="0" step="any" required value={form.quantity} onChange={(ev) => setForm({ ...form, quantity: ev.target.value })} />
          </label>
          <label className="text-xs text-stone-600">
            Meal
            <select className="input mt-1" value={form.meal} onChange={(ev) => setForm({ ...form, meal: ev.target.value as Meal })}>
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-600">
            Date
            <input className="input mt-1" type="date" required value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} />
          </label>
          <label className="text-xs text-stone-600">
            kcal
            <input className="input mt-1" type="number" min="0" step="1" required value={form.kcal} onChange={(ev) => setForm({ ...form, kcal: ev.target.value })} />
          </label>
        </div>
        <p className="text-xs text-stone-500">Changing the amount scales the calories and macros. Type calories only to override them.</p>
        <ErrorText error={save.error} />
        <div className="flex gap-2">
          <button className="btn" disabled={save.isPending || !(Number(form.quantity) > 0)}>Save</button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    </li>
  );
}

/** Log a single food or one of your recipes to the day being shown. */
function AddToDay({ date }: { date: string }) {
  const [mode, setMode] = useState<"food" | "recipe">("food");
  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`;
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Add to {dayLabel(date).replace(/^(Today|Yesterday|Tomorrow)$/, (w) => w.toLowerCase())}</h2>
      <div className="flex rounded-lg bg-stone-100 p-1" role="tablist">
        <button role="tab" aria-selected={mode === "food"} className={tab(mode === "food")} onClick={() => setMode("food")}>A food</button>
        <button role="tab" aria-selected={mode === "recipe"} className={tab(mode === "recipe")} onClick={() => setMode("recipe")}>A recipe</button>
      </div>
      {mode === "food" ? <AddFood date={date} /> : <AddRecipe date={date} />}
    </div>
  );
}

function MealSelect({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <select className="input" aria-label="Meal" value={value} onChange={(e) => onChange(e.target.value as Meal)}>
      {MEALS.map((m) => (
        <option key={m.id} value={m.id}>{m.label}</option>
      ))}
    </select>
  );
}

function AddRecipe({ date }: { date: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  const [servings, setServings] = useState("1");
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const term = useDebounced(q.trim(), 250);
  const recipes = useQuery({ queryKey: ["recipes", "picker", term], queryFn: () => listRecipes({ q: term }) });
  const kcal = recipe ? Math.round(recipe.perServing.kcal * (Number(servings) || 0)) : 0;
  const add = useMutation({
    mutationFn: () => logRecipe({ date, meal, recipeId: recipe!.id, servings: Number(servings) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      toast(`Logged ${recipe!.name} to ${mealLabel(meal)}`);
      setRecipe(null);
      setQ("");
    },
  });

  if (!recipe) {
    return (
      <div className="space-y-2">
        <input className="input" placeholder="Search your recipes" value={q} onChange={(e) => setQ(e.target.value)} />
        {recipes.data?.length === 0 && <p className="text-sm text-stone-500">{term ? "No recipes match." : "You have no recipes yet."}</p>}
        <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200 empty:hidden">
          {recipes.data?.slice(0, 30).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  setRecipe(r);
                  setServings("1");
                  if (r.meal) setMeal(r.meal);
                }}
              >
                <span>{r.name}</span>
                <span className="shrink-0 text-stone-500">{r.perServing.kcal} kcal</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <div className="text-sm font-medium">{recipe.name}</div>
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <label className="text-xs text-stone-600">
          Servings
          <input className="input mt-1" type="number" min="0.25" step="0.25" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
        <label className="text-xs text-stone-600">
          Meal
          <div className="mt-1"><MealSelect value={meal} onChange={setMeal} /></div>
        </label>
      </div>
      <ErrorText error={add.error} />
      <div className="flex gap-2">
        <button className="btn flex-1" disabled={!(Number(servings) > 0) || add.isPending}>Log {kcal} kcal</button>
        <button type="button" className="btn-secondary" onClick={() => setRecipe(null)}>Back</button>
      </div>
    </form>
  );
}

function AddFood({ date }: { date: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [food, setFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [portionId, setPortionId] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const add = useMutation({
    mutationFn: () => logFood({ date, meal, foodId: food!.id, quantity: Number(quantity), portionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      toast(`Logged ${food!.name} to ${mealLabel(meal)}`);
      setFood(null);
    },
  });
  const preview = food
    ? rounded(ingredientNutrients({ food, quantity: Number(quantity) || 0, portionGrams: food.portions.find((p) => p.id === portionId)?.gramWeight ?? null }))
    : null;

  return (
    <>
      {!food ? (
        <FoodPicker
          onPick={(f) => {
            setFood(f);
            setPortionId(f.portions[0]?.id ?? null);
            setQuantity(f.portions.length ? "1" : "100");
          }}
        />
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="text-sm font-medium">{food.name}</div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <input className="input" type="number" min="0" step="any" aria-label="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <PortionSelect food={food} value={portionId} onChange={setPortionId} />
          </div>
          <MealSelect value={meal} onChange={setMeal} />
          <ErrorText error={add.error} />
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!(Number(quantity) > 0) || add.isPending}>Log {preview?.kcal} kcal</button>
            <button type="button" className="btn-secondary" onClick={() => setFood(null)}>Back</button>
          </div>
        </form>
      )}
    </>
  );
}

function GoalForm({ current }: { current: Goal | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kcal, setKcal] = useState("");
  const [macros, setMacros] = useState({ proteinG: "", carbsG: "", fatG: "" });
  const optional = (s: string) => (s.trim() === "" ? null : Number(s));
  const save = useMutation({
    mutationFn: () =>
      setGoal({ dailyKcal: Number(kcal), proteinG: optional(macros.proteinG), carbsG: optional(macros.carbsG), fatG: optional(macros.fatG), from: today() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      setOpen(false);
      toast("Goal saved");
    },
  });
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Daily goal</h2>
        {!open && (
          <button
            className="text-sm text-emerald-700 underline"
            onClick={() => {
              setKcal(String(current?.dailyKcal ?? 2000));
              setMacros({ proteinG: String(current?.proteinG ?? ""), carbsG: String(current?.carbsG ?? ""), fatG: String(current?.fatG ?? "") });
              setOpen(true);
            }}
          >
            {current ? "Change" : "Set goal"}
          </button>
        )}
      </div>
      {!open && (
        <p className="text-sm text-stone-600">
          {current ? `${current.dailyKcal} kcal per day` : "No goal set."}
          {current &&
            [["protein", current.proteinG], ["carbs", current.carbsG], ["fat", current.fatG]]
              .filter(([, v]) => v != null)
              .map(([label, v]) => ` · ${v} g ${label}`)
              .join("")}
        </p>
      )}
      {open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-xs text-stone-600">
            Calories
            <input className="input mt-1" type="number" min="500" max="10000" step="50" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["proteinG", "carbsG", "fatG"] as const).map((k) => (
              <label key={k} className="text-xs text-stone-600">
                {{ proteinG: "Protein g", carbsG: "Carbs g", fatG: "Fat g" }[k]}
                <input className="input mt-1" type="number" min="0" step="1" placeholder="optional" value={macros[k]} onChange={(e) => setMacros({ ...macros, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <p className="text-xs text-stone-500">Applies from today on; past days keep their old goal.</p>
          <ErrorText error={save.error} />
          <div className="flex gap-2">
            <button className="btn" disabled={save.isPending}>Save</button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function WeekChart({ end }: { end: string }) {
  const from = shiftDay(end, -6);
  const summary = useQuery({ queryKey: ["log", "summary", from, end], queryFn: () => getSummary(from, end) });
  const data = (summary.data ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
  }));
  const goal = data.at(-1)?.goalKcal ?? null;
  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Last 7 days</h2>
      <p className="mb-2 text-xs text-stone-500">Calories per day{goal ? `, dashed line = ${goal} kcal goal` : ""}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e5e4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#78716c" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#78716c" domain={[0, (max: number) => Math.max(max, goal ?? 0)]} />
            <Tooltip cursor={{ fill: "#f5f5f4" }} formatter={(v) => [`${v} kcal`, "Eaten"]} labelFormatter={(_, p) => p?.[0]?.payload.date ?? ""} />
            {goal && <ReferenceLine y={goal} stroke="#57534e" strokeDasharray="4 4" />}
            <Bar dataKey="kcal" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
