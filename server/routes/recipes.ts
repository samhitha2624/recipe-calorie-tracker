import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { gramsOf, ingredientNutrients, perServing, recipeTotals, rounded, type IngredientInput } from "../../shared/nutrition.js";
import { HttpError, idParam, notFound } from "../http.js";

const recipeBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  servings: z.number().positive().max(100),
  instructions: z.string().trim().max(10000).default(""),
  imageUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  ingredients: z
    .array(
      z.object({
        foodId: z.number().int().positive(),
        quantity: z.number().positive().max(100000),
        portionId: z.number().int().positive().nullable().default(null),
        note: z.string().trim().max(120).default(""),
      }),
    )
    .min(1, "add at least one ingredient")
    .max(60),
});
const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(""),
});

const withIngredients = {
  ingredients: { include: { food: true, portion: true }, orderBy: { position: "asc" } },
} satisfies Prisma.RecipeInclude;
type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: typeof withIngredients }>;

const toInput = (i: RecipeWithIngredients["ingredients"][number]): IngredientInput => ({
  food: i.food,
  quantity: i.quantity,
  portionGrams: i.portion?.gramWeight ?? null,
});

export function recipeNutrition(recipe: RecipeWithIngredients) {
  const total = recipeTotals(recipe.ingredients.map(toInput));
  return { total, perServing: perServing(total, recipe.servings) };
}

export function recipeRoutes(prisma: PrismaClient) {
  const r = Router();

  async function ratings(recipeIds: number[]) {
    const rows = await prisma.review.groupBy({
      by: ["recipeId"],
      where: { recipeId: { in: recipeIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(rows.map((x) => [x.recipeId, { average: x._avg.rating, count: x._count._all }]));
  }

  async function checkIngredients(ingredients: z.infer<typeof recipeBody>["ingredients"]) {
    const foodIds = [...new Set(ingredients.map((i) => i.foodId))];
    const foods = await prisma.food.findMany({ where: { id: { in: foodIds } }, include: { portions: true } });
    const byId = new Map(foods.map((f) => [f.id, f]));
    for (const i of ingredients) {
      const food = byId.get(i.foodId);
      if (!food) throw new HttpError(400, `Unknown food ${i.foodId}`);
      if (i.portionId != null && !food.portions.some((p) => p.id === i.portionId)) {
        throw new HttpError(400, `Portion ${i.portionId} doesn't belong to ${food.name}`);
      }
    }
  }

  r.get("/", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.RecipeWhereInput = {};
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (req.query.author === "me") where.authorId = req.user!.id;
    const recipes = await prisma.recipe.findMany({
      where,
      include: { ...withIngredients, author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const ratingById = await ratings(recipes.map((x) => x.id));
    const out = recipes.map((x) => ({
      id: x.id,
      name: x.name,
      description: x.description,
      servings: x.servings,
      imageUrl: x.imageUrl,
      author: x.author,
      createdAt: x.createdAt,
      perServing: rounded(recipeNutrition(x).perServing),
      rating: ratingById.get(x.id) ?? { average: null, count: 0 },
    }));
    if (req.query.sort === "top") {
      out.sort((a, b) => (b.rating.average ?? 0) - (a.rating.average ?? 0) || b.rating.count - a.rating.count);
    }
    res.json(out);
  });

  r.get("/:id", async (req, res) => {
    const recipe = await prisma.recipe.findUnique({
      where: { id: idParam(req.params.id) },
      include: {
        ...withIngredients,
        author: { select: { id: true, name: true } },
        reviews: { include: { user: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } },
      },
    });
    if (!recipe) throw notFound("Recipe not found");
    const { total, perServing } = recipeNutrition(recipe);
    const { reviews, ingredients, ...fields } = recipe;
    const count = reviews.length;
    res.json({
      ...fields,
      ingredients: ingredients.map((i) => ({
        id: i.id,
        food: i.food,
        portion: i.portion,
        quantity: i.quantity,
        note: i.note,
        grams: gramsOf(i.quantity, i.portion?.gramWeight ?? null),
        nutrients: rounded(ingredientNutrients(toInput(i))),
      })),
      total: rounded(total),
      perServing: rounded(perServing),
      rating: { average: count ? reviews.reduce((s, x) => s + x.rating, 0) / count : null, count },
      reviews,
      canEdit: recipe.authorId === req.user!.id,
    });
  });

  r.post("/", async (req, res) => {
    const { ingredients, ...fields } = recipeBody.parse(req.body);
    await checkIngredients(ingredients);
    const recipe = await prisma.recipe.create({
      data: {
        ...fields,
        authorId: req.user!.id,
        ingredients: { create: ingredients.map((i, position) => ({ ...i, position })) },
      },
    });
    res.status(201).json({ id: recipe.id });
  });

  async function ownRecipe(id: number, userId: number) {
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw notFound("Recipe not found");
    if (recipe.authorId !== userId) throw new HttpError(403, "Only the author can change this recipe");
    return recipe;
  }

  r.put("/:id", async (req, res) => {
    const id = idParam(req.params.id);
    await ownRecipe(id, req.user!.id);
    const { ingredients, ...fields } = recipeBody.parse(req.body);
    await checkIngredients(ingredients);
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      prisma.recipe.update({
        where: { id },
        data: { ...fields, ingredients: { create: ingredients.map((i, position) => ({ ...i, position })) } },
      }),
    ]);
    res.json({ id });
  });

  r.delete("/:id", async (req, res) => {
    const id = idParam(req.params.id);
    await ownRecipe(id, req.user!.id);
    await prisma.recipe.delete({ where: { id } });
    res.status(204).end();
  });

  // One review per user per recipe; PUT creates or replaces it.
  r.put("/:id/review", async (req, res) => {
    const recipeId = idParam(req.params.id);
    const body = reviewBody.parse(req.body);
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) throw notFound("Recipe not found");
    if (recipe.authorId === req.user!.id) throw new HttpError(403, "You can't review your own recipe");
    const review = await prisma.review.upsert({
      where: { recipeId_userId: { recipeId, userId: req.user!.id } },
      update: body,
      create: { ...body, recipeId, userId: req.user!.id },
    });
    res.json(review);
  });

  r.delete("/:id/review", async (req, res) => {
    await prisma.review.deleteMany({ where: { recipeId: idParam(req.params.id), userId: req.user!.id } });
    res.status(204).end();
  });

  return r;
}
