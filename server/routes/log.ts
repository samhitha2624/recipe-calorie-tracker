import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { add, ingredientNutrients, rounded, scale, ZERO, type Nutrients } from "../../shared/nutrition.js";
import { formatDay, HttpError, idParam, notFound, parseDay } from "../http.js";
import { recipeNutrition } from "./recipes.js";

const meal = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const logBody = z.union([
  z.object({ date: z.string(), meal, recipeId: z.number().int().positive(), servings: z.number().positive().max(50) }),
  z.object({
    date: z.string(),
    meal,
    foodId: z.number().int().positive(),
    quantity: z.number().positive().max(100000),
    portionId: z.number().int().positive().nullable().default(null),
  }),
]);
const goalBody = z.object({
  dailyKcal: z.number().int().min(500).max(10000),
  proteinG: z.number().min(0).max(1000).nullable().default(null),
  carbsG: z.number().min(0).max(2000).nullable().default(null),
  fatG: z.number().min(0).max(1000).nullable().default(null),
  /** The user's local "today"; the goal applies from this date on. */
  from: z.string().optional(),
});

const nutrientsOf = (e: Nutrients): Nutrients => ({
  kcal: e.kcal,
  proteinG: e.proteinG,
  carbsG: e.carbsG,
  fatG: e.fatG,
  fiberG: e.fiberG,
});

export function logRoutes(prisma: PrismaClient) {
  const r = Router();

  const goalOn = (userId: number, date: Date) =>
    prisma.goal.findFirst({ where: { userId, effectiveFrom: { lte: date } }, orderBy: { effectiveFrom: "desc" } });

  r.get("/", async (req, res) => {
    const date = parseDay(req.query.date);
    const userId = req.user!.id;
    const [entries, goal] = await Promise.all([
      prisma.logEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" }, include: { portion: true } }),
      goalOn(userId, date),
    ]);
    const total = entries.map(nutrientsOf).reduce(add, ZERO);
    res.json({ date: formatDay(date), entries: entries.map((e) => ({ ...e, date: formatDay(e.date) })), total: rounded(total), goal });
  });

  r.post("/", async (req, res) => {
    const body = logBody.parse(req.body);
    const date = parseDay(body.date);
    let data: { name: string; quantity: number; recipeId?: number; foodId?: number; portionId?: number | null } & Nutrients;
    if ("recipeId" in body) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: body.recipeId },
        include: { ingredients: { include: { food: true, portion: true } } },
      });
      if (!recipe) throw notFound("Recipe not found");
      const n = scale(recipeNutrition(recipe).perServing, body.servings);
      data = { ...n, name: recipe.name, recipeId: recipe.id, quantity: body.servings };
    } else {
      const food = await prisma.food.findUnique({ where: { id: body.foodId }, include: { portions: true } });
      if (!food) throw notFound("Food not found");
      const portion = body.portionId == null ? null : food.portions.find((p) => p.id === body.portionId);
      if (portion === undefined) throw new HttpError(400, "That portion doesn't belong to this food");
      const n = ingredientNutrients({ food, quantity: body.quantity, portionGrams: portion?.gramWeight ?? null });
      data = { ...n, name: food.name, foodId: food.id, portionId: portion?.id ?? null, quantity: body.quantity };
    }
    const entry = await prisma.logEntry.create({ data: { ...data, userId: req.user!.id, date, meal: body.meal } });
    res.status(201).json({ ...entry, date: formatDay(entry.date) });
  });

  r.delete("/:id", async (req, res) => {
    const { count } = await prisma.logEntry.deleteMany({ where: { id: idParam(req.params.id), userId: req.user!.id } });
    if (!count) throw notFound("Entry not found");
    res.status(204).end();
  });

  // Daily totals for a date range (inclusive), with the goal that applied each day.
  r.get("/summary", async (req, res) => {
    const from = parseDay(req.query.from);
    const to = parseDay(req.query.to);
    const days = Math.round((to.getTime() - from.getTime()) / 864e5) + 1;
    if (days < 1 || days > 92) throw new HttpError(400, "range must be 1 to 92 days");
    const userId = req.user!.id;
    const [sums, goals] = await Promise.all([
      prisma.logEntry.groupBy({
        by: ["date"],
        where: { userId, date: { gte: from, lte: to } },
        _sum: { kcal: true, proteinG: true, carbsG: true, fatG: true, fiberG: true },
      }),
      prisma.goal.findMany({ where: { userId, effectiveFrom: { lte: to } }, orderBy: { effectiveFrom: "asc" } }),
    ]);
    const byDay = new Map(sums.map((s) => [formatDay(s.date), s._sum]));
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * 864e5);
      const key = formatDay(d);
      const s = byDay.get(key);
      const goal = goals.filter((g) => g.effectiveFrom <= d).at(-1);
      out.push({
        date: key,
        ...rounded(s ? { kcal: s.kcal ?? 0, proteinG: s.proteinG ?? 0, carbsG: s.carbsG ?? 0, fatG: s.fatG ?? 0, fiberG: s.fiberG ?? 0 } : ZERO),
        goalKcal: goal?.dailyKcal ?? null,
      });
    }
    res.json(out);
  });

  return r;
}

export function goalRoutes(prisma: PrismaClient) {
  const r = Router();

  r.get("/", async (req, res) => {
    const goal = await prisma.goal.findFirst({ where: { userId: req.user!.id }, orderBy: { effectiveFrom: "desc" } });
    res.json(goal);
  });

  r.put("/", async (req, res) => {
    const { from, ...fields } = goalBody.parse(req.body);
    const effectiveFrom = from ? parseDay(from) : parseDay(formatDay(new Date()));
    const userId = req.user!.id;
    const goal = await prisma.goal.upsert({
      where: { userId_effectiveFrom: { userId, effectiveFrom } },
      update: fields,
      create: { ...fields, userId, effectiveFrom },
    });
    res.json(goal);
  });

  return r;
}
