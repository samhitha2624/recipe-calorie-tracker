// The app's data, in Firestore: the foods, recipes, log and goals collections, plus meta/profile.
// Only the owner can read or write them (see firestore.rules). Pages call these functions, not Firestore.
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, type DocumentData } from "firebase/firestore";
import { z } from "zod";
import { parseIngredients, type LineResult } from "../../shared/ingredients";
import { KITCHEN, kitchenPortions, searchKitchen } from "../../shared/kitchen";
import { add, gramsOf, ingredientNutrients, perServing, recipeTotals, rounded, scale, ZERO, type Nutrients } from "../../shared/nutrition";
import { FdcClient, FdcError, type FdcSearchHit } from "../../shared/usda";
import { auth, db, usernameOf } from "./firebase";
import { isDay, validate } from "./validation";

// ---------- Types ----------

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
/** Meals in the order the app shows them. */
export const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snacks" },
  { id: "dinner", label: "Dinner" },
];
export const mealLabel = (m: Meal | null) => MEALS.find((x) => x.id === m)?.label ?? "Other";

export interface User { name: string; username: string }
export interface Portion { id: string; label: string; gramWeight: number }
/** kitchen: built-in item; custom: entered by you; usda: saved from USDA FoodData Central. */
export type FoodKind = "kitchen" | "custom" | "usda";
export interface Food extends Nutrients {
  id: string;
  name: string;
  kind: FoodKind;
  kitchenKey: string | null;
  fdcId: number | null;
  dataType: string;
  kcalEstimated: boolean;
  portions: Portion[];
}
export type UsdaHit = FdcSearchHit;
export interface Rating { average: number | null; count: number }
export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
  servings: number;
  meal: Meal | null;
  imageUrl: string | null;
  createdAt: number;
  perServing: Nutrients;
  rating: Rating;
}
export interface MyReview { rating: number; comment: string; updatedAt: number }
export interface RecipeIngredientView { id: string; food: Food; portion: Portion | null; quantity: number; note: string; grams: number; nutrients: Nutrients }
export interface RecipeDetail extends RecipeSummary {
  instructions: string;
  ingredients: RecipeIngredientView[];
  total: Nutrients;
  myReview: MyReview | null;
}
export type ParsedLine = LineResult<Food>;
export interface Goal { dailyKcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null; effectiveFrom: string }
export interface LogEntry extends Nutrients {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  recipeId: string | null;
  foodId: string | null;
  quantity: number;
  portion: { label: string; gramWeight: number } | null;
  createdAt: number;
}
export interface DayLog { date: string; entries: LogEntry[]; total: Nutrients; goal: Goal | null }
export interface DaySummary extends Nutrients { date: string; goalKcal: number | null }

interface StoredIngredient { foodId: string; quantity: number; portionId: string | null; note: string }
interface StoredRecipe {
  name: string;
  description: string;
  servings: number;
  meal: Meal | null;
  instructions: string;
  imageUrl: string | null;
  ingredients: StoredIngredient[];
  rating: MyReview | null;
  createdAt: number;
  updatedAt: number;
}

// ---------- Dates ----------

/** Local calendar date as YYYY-MM-DD. */
export function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Helpers ----------

type Collection = "foods" | "recipes" | "log" | "goals";
function signedIn() {
  if (!auth.currentUser) throw new Error("Please sign in again.");
}
const userCol = (name: Collection) => (signedIn(), collection(db, name));
const userDoc = (name: Collection, id: string) => (signedIn(), doc(db, name, id));
const profileDoc = () => (signedIn(), doc(db, "meta", "profile"));
const withId = <T,>(d: { id: string; data(): DocumentData }) => ({ ...d.data(), id: d.id }) as T;
const newPortionId = () => crypto.randomUUID().slice(0, 8);
const notFound = (what: string) => new Error(`${what} not found. It may have been deleted.`);

const meal = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const day = z.string().refine(isDay, "must be a real date");
const nutrientsPer100g = {
  kcal: z.number().min(0).max(900),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
  fiberG: z.number().min(0).max(100).default(0),
};

// ---------- Profile ----------

export async function getProfile(): Promise<User> {
  const username = usernameOf(auth.currentUser?.email ?? null);
  const snap = await getDoc(profileDoc());
  return { name: (snap.data()?.name as string | undefined) ?? username, username };
}

export async function setName(name: string): Promise<User> {
  const clean = validate(z.string().trim().min(1, "Name is required").max(60), name);
  await setDoc(profileDoc(), { name: clean }, { merge: true });
  return getProfile();
}

// ---------- Foods ----------

export async function listFoods(): Promise<Food[]> {
  const snap = await getDocs(userCol("foods"));
  return snap.docs.map((d) => withId<Food>(d)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFood(id: string): Promise<Food & { usedInRecipes: number }> {
  const [snap, recipes] = await Promise.all([getDoc(userDoc("foods", id)), listStoredRecipes()]);
  if (!snap.exists()) throw notFound("Food");
  return { ...withId<Food>(snap), usedInRecipes: recipes.filter((r) => r.ingredients.some((i) => i.foodId === id)).length };
}

/** Adds kitchen items you don't have yet. Ones you already have are left alone, so your edits stay. */
export async function syncKitchen(): Promise<number> {
  const have = new Set((await listFoods()).map((f) => f.kitchenKey).filter(Boolean));
  const missing = KITCHEN.filter((k) => !have.has(k.key));
  if (!missing.length) return 0;
  const batch = writeBatch(db);
  for (const item of missing) {
    const [kcal, proteinG, carbsG, fatG, fiberG] = item.per100g;
    const food: Omit<Food, "id"> = {
      name: item.name,
      kind: "kitchen",
      kitchenKey: item.key,
      fdcId: null,
      dataType: "Kitchen",
      kcalEstimated: false,
      kcal, proteinG, carbsG, fatG, fiberG,
      portions: kitchenPortions(item).map((p) => ({ ...p, id: newPortionId() })),
    };
    batch.set(doc(userCol("foods")), food);
  }
  await batch.commit();
  return missing.length;
}

const foodInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  ...nutrientsPer100g,
  portions: z
    .array(z.object({ id: z.string().optional(), label: z.string().trim().min(1, "Portion name is required").max(60), gramWeight: z.number().positive().max(10000) }))
    .max(20)
    .default([]),
});
export type FoodInput = z.input<typeof foodInput>;

export async function createFood(input: FoodInput): Promise<Food> {
  const { portions, ...fields } = validate(foodInput, input);
  const food: Omit<Food, "id"> = {
    ...fields,
    kind: "custom",
    kitchenKey: null,
    fdcId: null,
    dataType: "Custom",
    kcalEstimated: false,
    portions: portions.map((p) => ({ id: newPortionId(), label: p.label, gramWeight: p.gramWeight })),
  };
  const ref = await addDoc(userCol("foods"), food);
  return { ...food, id: ref.id };
}

/** Edit any food. Recipes use the new values straight away; days already logged keep their calories. */
export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const { portions, ...fields } = validate(foodInput, input);
  const current = await getFood(id);
  const kept = new Set(portions.flatMap((p) => (p.id ? [p.id] : [])));
  const removed = current.portions.filter((p) => !kept.has(p.id));
  if (removed.length) {
    const recipes = await listStoredRecipes();
    for (const r of recipes) {
      const used = r.ingredients.find((i) => i.foodId === id && removed.some((p) => p.id === i.portionId));
      if (used) throw new Error(`"${removed.find((p) => p.id === used.portionId)!.label}" is used in the recipe "${r.name}". Change that recipe first.`);
    }
  }
  const next = {
    ...fields,
    kcalEstimated: false,
    portions: portions.map((p) => ({ id: p.id && current.portions.some((c) => c.id === p.id) ? p.id : newPortionId(), label: p.label, gramWeight: p.gramWeight })),
  };
  await updateDoc(userDoc("foods", id), next);
  const { usedInRecipes: _, ...rest } = current;
  return { ...rest, ...next };
}

/** Foods used in a recipe can't be deleted; log entries keep their calories. */
export async function deleteFood(id: string) {
  const used = (await listStoredRecipes()).find((r) => r.ingredients.some((i) => i.foodId === id));
  if (used) throw new Error(`It's used in the recipe "${used.name}". Remove it there first.`);
  await deleteDoc(userDoc("foods", id));
}

const usda = new FdcClient(import.meta.env.VITE_FDC_API_KEY || "DEMO_KEY");

/** Your kitchen items first, then your own and saved foods, then USDA results you haven't saved yet. */
export async function searchFoods(q: string): Promise<{ kitchen: Food[]; saved: Food[]; usda: UsdaHit[]; usdaError: string | null }> {
  const text = q.trim().toLowerCase();
  if (text.length < 2) return { kitchen: [], saved: [], usda: [], usdaError: null };
  const foods = await listFoods();
  const keys = searchKitchen(text).map((k) => k.key);
  const kitchenFoods = foods.filter((f) => f.kind === "kitchen");
  const kitchen = [
    ...keys.flatMap((key) => kitchenFoods.find((f) => f.kitchenKey === key) ?? []),
    ...kitchenFoods.filter((f) => !keys.includes(f.kitchenKey!) && f.name.toLowerCase().includes(text)),
  ];
  const saved = foods.filter((f) => f.kind !== "kitchen" && f.name.toLowerCase().includes(text)).slice(0, 10);
  let hits: UsdaHit[] = [];
  let usdaError: string | null = null;
  try {
    const savedIds = new Set(foods.map((f) => f.fdcId));
    hits = (await usda.search(text)).filter((h) => !savedIds.has(h.fdcId));
  } catch (e) {
    usdaError = e instanceof FdcError && e.status === 429 ? "USDA search is busy, try again shortly" : "USDA search is unavailable right now";
  }
  return { kitchen, saved, usda: hits, usdaError };
}

/** Saves a USDA food into your foods (once) and returns it. */
export async function importUsda(fdcId: number): Promise<Food> {
  const existing = (await listFoods()).find((f) => f.fdcId === fdcId);
  if (existing) return existing;
  let fetched;
  try {
    fetched = await usda.food(fdcId);
  } catch (e) {
    throw new Error(e instanceof FdcError && e.status === 404 ? "That USDA food doesn't exist." : "Couldn't reach USDA FoodData Central. Try again shortly.");
  }
  const { portions, ...fields } = fetched;
  const food: Omit<Food, "id"> = { ...fields, kind: "usda", kitchenKey: null, portions: portions.map((p) => ({ ...p, id: newPortionId() })) };
  const ref = await addDoc(userCol("foods"), food);
  return { ...food, id: ref.id };
}

/** Reads pasted ingredient lines ("2 cups milk") against your own foods and kitchen items. */
export async function parseIngredientText(text: string): Promise<ParsedLine[]> {
  const foods = await listFoods();
  const aliases = new Map(KITCHEN.map((k) => [k.key, k.aliases]));
  const candidates = [
    ...foods.filter((f) => f.kind !== "kitchen").map((f) => ({ names: [f.name], value: f })),
    ...foods.filter((f) => f.kind === "kitchen").map((f) => ({ names: [f.name, ...(aliases.get(f.kitchenKey!) ?? [])], value: f })),
  ];
  return parseIngredients(text, candidates);
}

// ---------- Recipes ----------

async function listStoredRecipes(): Promise<(StoredRecipe & { id: string })[]> {
  const snap = await getDocs(userCol("recipes"));
  return snap.docs.map((d) => withId<StoredRecipe & { id: string }>(d));
}

function resolveIngredients(r: StoredRecipe, foods: Map<string, Food>): RecipeIngredientView[] {
  return r.ingredients.flatMap((i, n) => {
    const food = foods.get(i.foodId);
    if (!food) return [];
    const portion = food.portions.find((p) => p.id === i.portionId) ?? null;
    const input = { food, quantity: i.quantity, portionGrams: portion?.gramWeight ?? null };
    return [{ id: String(n), food, portion, quantity: i.quantity, note: i.note, grams: gramsOf(i.quantity, portion?.gramWeight ?? null), nutrients: rounded(ingredientNutrients(input)) }];
  });
}

function nutritionOf(r: StoredRecipe, foods: Map<string, Food>) {
  const ingredients = resolveIngredients(r, foods);
  const total = recipeTotals(ingredients.map((i) => ({ food: i.food, quantity: i.quantity, portionGrams: i.portion?.gramWeight ?? null })));
  return { ingredients, total, perServing: perServing(total, r.servings) };
}

const summaryOf = (r: StoredRecipe & { id: string }, foods: Map<string, Food>): RecipeSummary => ({
  id: r.id,
  name: r.name,
  description: r.description,
  servings: r.servings,
  meal: r.meal,
  imageUrl: r.imageUrl,
  createdAt: r.createdAt,
  perServing: rounded(nutritionOf(r, foods).perServing),
  rating: r.rating ? { average: r.rating.rating, count: 1 } : { average: null, count: 0 },
});

export async function listRecipes(filters: { q?: string; sort?: "new" | "top"; meal?: Meal } = {}): Promise<RecipeSummary[]> {
  const [recipes, foods] = await Promise.all([listStoredRecipes(), listFoods()]);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const q = filters.q?.trim().toLowerCase();
  return recipes
    .filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!filters.meal || r.meal === filters.meal))
    .map((r) => summaryOf(r, byId))
    .sort((a, b) =>
      filters.sort === "top" ? (b.rating.average ?? 0) - (a.rating.average ?? 0) || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    );
}

export async function getRecipe(id: string): Promise<RecipeDetail> {
  const [snap, foods] = await Promise.all([getDoc(userDoc("recipes", id)), listFoods()]);
  if (!snap.exists()) throw notFound("Recipe");
  const r = withId<StoredRecipe & { id: string }>(snap);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const { ingredients, total, perServing: serving } = nutritionOf(r, byId);
  return {
    ...summaryOf(r, byId),
    instructions: r.instructions,
    ingredients,
    total: rounded(total),
    perServing: rounded(serving),
    myReview: r.rating,
  };
}

const recipeInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  meal: meal.nullable().default(null),
  description: z.string().trim().max(500).default(""),
  servings: z.number().positive().max(100),
  instructions: z.string().trim().max(10000).default(""),
  imageUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  ingredients: z
    .array(
      z.object({
        foodId: z.string().min(1),
        quantity: z.number().positive().max(100000),
        portionId: z.string().nullable().default(null),
        note: z.string().trim().max(120).default(""),
      }),
    )
    .min(1, "Add at least one ingredient")
    .max(60),
});
export type RecipeInput = z.input<typeof recipeInput>;

/** Creates a recipe (id null) or replaces one. Returns its id. */
export async function saveRecipe(id: string | null, input: RecipeInput): Promise<string> {
  const data = validate(recipeInput, input);
  const foods = new Map((await listFoods()).map((f) => [f.id, f]));
  for (const i of data.ingredients) {
    const food = foods.get(i.foodId);
    if (!food) throw new Error("One of the ingredients no longer exists. Remove it and add it again.");
    if (i.portionId != null && !food.portions.some((p) => p.id === i.portionId)) throw new Error(`That portion doesn't belong to ${food.name}.`);
  }
  const now = Date.now();
  const fields = { ...data, imageUrl: data.imageUrl ?? null, updatedAt: now };
  if (id) {
    const existing = await getDoc(userDoc("recipes", id));
    if (!existing.exists()) throw notFound("Recipe");
    await updateDoc(userDoc("recipes", id), fields);
    return id;
  }
  const ref = await addDoc(userCol("recipes"), { ...fields, rating: null, createdAt: now } satisfies StoredRecipe);
  return ref.id;
}

export async function deleteRecipe(id: string) {
  await deleteDoc(userDoc("recipes", id));
}

/** Your stars and notes for a recipe. */
export async function rateRecipe(id: string, input: { rating: number; comment: string }) {
  const { rating, comment } = validate(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).default("") }), input);
  await updateDoc(userDoc("recipes", id), { rating: { rating, comment, updatedAt: Date.now() } });
}

// ---------- Daily log ----------

const nutrientsOf = (n: Nutrients): Nutrients => ({ kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG, fiberG: n.fiberG });

async function entriesBetween(from: string, to: string): Promise<LogEntry[]> {
  const snap = await getDocs(query(userCol("log"), where("date", ">=", from), where("date", "<=", to)));
  return snap.docs.map((d) => withId<LogEntry>(d)).sort((a, b) => a.createdAt - b.createdAt);
}

async function goalsUpTo(date: string): Promise<Goal[]> {
  const snap = await getDocs(query(userCol("goals"), where("effectiveFrom", "<=", date)));
  return snap.docs.map((d) => d.data() as Goal).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export async function getDay(date: string): Promise<DayLog> {
  const [entries, goals] = await Promise.all([entriesBetween(date, date), goalsUpTo(date)]);
  return { date, entries, total: rounded(entries.map(nutrientsOf).reduce(add, ZERO)), goal: goals.at(-1) ?? null };
}

/** Daily totals from `from` to `to` (inclusive), with the goal that applied each day. */
export async function getSummary(from: string, to: string): Promise<DaySummary[]> {
  const [entries, goals] = await Promise.all([entriesBetween(from, to), goalsUpTo(to)]);
  const out: DaySummary[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) {
    const total = entries.filter((e) => e.date === d).map(nutrientsOf).reduce(add, ZERO);
    out.push({ date: d, ...rounded(total), goalKcal: goals.filter((g) => g.effectiveFrom <= d).at(-1)?.dailyKcal ?? null });
  }
  return out;
}

export async function logRecipe(input: { date: string; meal: Meal; recipeId: string; servings: number }) {
  const { date, meal: m, recipeId, servings } = validate(z.object({ date: day, meal, recipeId: z.string(), servings: z.number().positive().max(50) }), input);
  const [snap, foods] = await Promise.all([getDoc(userDoc("recipes", recipeId)), listFoods()]);
  if (!snap.exists()) throw notFound("Recipe");
  const recipe = withId<StoredRecipe & { id: string }>(snap);
  // Calories are copied into the entry, so later recipe edits don't change days already logged.
  const n = scale(nutritionOf(recipe, new Map(foods.map((f) => [f.id, f]))).perServing, servings);
  const entry: Omit<LogEntry, "id"> = { ...n, date, meal: m, name: recipe.name, recipeId, foodId: null, quantity: servings, portion: null, createdAt: Date.now() };
  await addDoc(userCol("log"), entry);
}

export async function logFood(input: { date: string; meal: Meal; foodId: string; quantity: number; portionId: string | null }) {
  const { date, meal: m, foodId, quantity, portionId } = validate(
    z.object({ date: day, meal, foodId: z.string(), quantity: z.number().positive().max(100000), portionId: z.string().nullable() }),
    input,
  );
  const food = await getFood(foodId);
  const portion = portionId == null ? null : food.portions.find((p) => p.id === portionId);
  if (portion === undefined) throw new Error("That portion doesn't belong to this food.");
  const n = ingredientNutrients({ food, quantity, portionGrams: portion?.gramWeight ?? null });
  const entry: Omit<LogEntry, "id"> = {
    ...n,
    date,
    meal: m,
    name: food.name,
    recipeId: null,
    foodId,
    quantity,
    portion: portion ? { label: portion.label, gramWeight: portion.gramWeight } : null,
    createdAt: Date.now(),
  };
  await addDoc(userCol("log"), entry);
}

const entryPatch = z.object({
  date: day.optional(),
  meal: meal.optional(),
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  quantity: z.number().positive().max(100000).optional(),
  kcal: z.number().min(0).max(20000).optional(),
});

/** Fix a logged entry. A new amount scales its calories and macros; calories typed in directly win over that. */
export async function updateEntry(id: string, input: z.input<typeof entryPatch>) {
  const { quantity, kcal, ...rest } = validate(entryPatch, input);
  const snap = await getDoc(userDoc("log", id));
  if (!snap.exists()) throw notFound("Entry");
  const entry = withId<LogEntry>(snap);
  const scaled = quantity ? scale(nutrientsOf(entry), quantity / entry.quantity) : {};
  await updateDoc(userDoc("log", id), { ...rest, ...(quantity ? { quantity } : {}), ...scaled, ...(kcal !== undefined ? { kcal } : {}) });
}

export async function deleteEntry(id: string) {
  await deleteDoc(userDoc("log", id));
}

// ---------- Goals ----------

const goalInput = z.object({
  dailyKcal: z.number().int().min(500).max(10000),
  proteinG: z.number().min(0).max(1000).nullable().default(null),
  carbsG: z.number().min(0).max(2000).nullable().default(null),
  fatG: z.number().min(0).max(1000).nullable().default(null),
  from: day,
});

/** Sets the goal from a day onward (today, usually). Days before it keep their old goal. */
export async function setGoal(input: z.input<typeof goalInput>) {
  const { from, ...fields } = validate(goalInput, input);
  if (from < today(-1)) throw new Error("A new goal can't start in the past.");
  await setDoc(userDoc("goals", from), { ...fields, effectiveFrom: from } satisfies Goal);
}
