import type { Nutrients } from "../../shared/nutrition";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface User { id: number; email: string; name: string }
export interface Portion { id: number; label: string; gramWeight: number }
export interface Food extends Nutrients {
  id: number;
  fdcId: number | null;
  name: string;
  dataType: string;
  kcalEstimated: boolean;
  portions: Portion[];
}
export interface UsdaHit { fdcId: number; name: string; dataType: string; brand: string | null; kcalPer100g: number | null }
export interface Rating { average: number | null; count: number }
export interface RecipeSummary {
  id: number;
  name: string;
  description: string;
  servings: number;
  imageUrl: string | null;
  author: { id: number; name: string };
  createdAt: string;
  perServing: Nutrients;
  rating: Rating;
}
export interface Review { id: number; rating: number; comment: string; updatedAt: string; user: { id: number; name: string } }
export interface RecipeDetail extends Omit<RecipeSummary, "author"> {
  authorId: number;
  author: { id: number; name: string };
  instructions: string;
  ingredients: { id: number; food: Food; portion: Portion | null; quantity: number; note: string; grams: number; nutrients: Nutrients }[];
  total: Nutrients;
  reviews: Review[];
  canEdit: boolean;
}
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export interface Goal { dailyKcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null; effectiveFrom: string }
export interface LogEntry extends Nutrients {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  recipeId: number | null;
  foodId: number | null;
  quantity: number;
  portion: Portion | null;
}
export interface DayLog { date: string; entries: LogEntry[]; total: Nutrients; goal: Goal | null }
export interface DaySummary extends Nutrients { date: string; goalKcal: number | null }

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
