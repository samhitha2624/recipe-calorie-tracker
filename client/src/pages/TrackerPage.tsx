import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ingredientNutrients, rounded } from "../../../shared/nutrition";
import { api, shiftDay, today, type DayLog, type DaySummary, type Food, type Goal, type Meal } from "../api";
import { FoodPicker, PortionSelect } from "../components/FoodPicker";
import { ErrorText, MacroRow } from "../components/ui";

const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
];

export default function TrackerPage() {
  const [date, setDate] = useState(today());
  const qc = useQueryClient();
  const day = useQuery({ queryKey: ["log", date], queryFn: () => api<DayLog>(`/log?date=${date}`) });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/log/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log"] }),
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
          <h1 className="mr-auto text-2xl font-semibold">My day</h1>
          <button className="btn-secondary px-3" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">←</button>
          <input className="input w-auto" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
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

        <ErrorText error={day.error || remove.error} />
        {MEALS.map((m) => {
          const entries = d?.entries.filter((e) => e.meal === m.id) ?? [];
          const kcal = Math.round(entries.reduce((s, e) => s + e.kcal, 0));
          return (
            <section key={m.id} className="card">
              <div className="mb-2 flex justify-between">
                <h2 className="font-semibold">{m.label}</h2>
                <span className="text-sm text-stone-500">{kcal} kcal</span>
              </div>
              {entries.length === 0 && <p className="text-sm text-stone-400">Nothing logged.</p>}
              <ul className="divide-y divide-stone-100">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {e.name}
                      <span className="text-stone-500">
                        {" · "}
                        {e.recipeId != null || e.foodId == null
                          ? `${e.quantity} serving${e.quantity === 1 ? "" : "s"}`
                          : e.portion
                            ? `${e.quantity} × ${e.portion.label}`
                            : `${e.quantity} g`}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">{Math.round(e.kcal)} kcal</span>
                      <button className="text-stone-400 hover:text-red-700" aria-label={`Remove ${e.name}`} onClick={() => remove.mutate(e.id)}>
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="space-y-4">
        <AddFood date={date} />
        <GoalForm current={d?.goal ?? null} />
        <WeekChart end={date} />
      </aside>
    </div>
  );
}

function AddFood({ date }: { date: string }) {
  const qc = useQueryClient();
  const [food, setFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [portionId, setPortionId] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal>("snack");
  const add = useMutation({
    mutationFn: () => api("/log", { body: { date, meal, foodId: food!.id, quantity: Number(quantity), portionId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      setFood(null);
    },
  });
  const preview = food
    ? rounded(ingredientNutrients({ food, quantity: Number(quantity) || 0, portionGrams: food.portions.find((p) => p.id === portionId)?.gramWeight ?? null }))
    : null;

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Log a food</h2>
      <p className="text-xs text-stone-500">To log a recipe, open it from Recipes and use "Add to my day".</p>
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
          <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <ErrorText error={add.error} />
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!(Number(quantity) > 0) || add.isPending}>Log {preview?.kcal} kcal</button>
            <button type="button" className="btn-secondary" onClick={() => setFood(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function GoalForm({ current }: { current: Goal | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kcal, setKcal] = useState("");
  const save = useMutation({
    mutationFn: () => api("/goal", { method: "PUT", body: { dailyKcal: Number(kcal), from: today() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["log"] });
      setOpen(false);
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
              setOpen(true);
            }}
          >
            {current ? "Change" : "Set goal"}
          </button>
        )}
      </div>
      {!open && <p className="text-sm text-stone-600">{current ? `${current.dailyKcal} kcal per day` : "No goal set."}</p>}
      {open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <input className="input" type="number" min="500" max="10000" step="50" value={kcal} onChange={(e) => setKcal(e.target.value)} />
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
  const summary = useQuery({ queryKey: ["log", "summary", from, end], queryFn: () => api<DaySummary[]>(`/log/summary?from=${from}&to=${end}`) });
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
