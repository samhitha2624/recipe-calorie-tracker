import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { FdcClient } from "../server/fdc";
import { TEST_DB } from "./setup";

const EGG = {
  fdcId: 171287,
  description: "Egg, whole, raw, fresh",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrient: { id: 1008 }, amount: 143 },
    { nutrient: { id: 1003 }, amount: 12.6 },
    { nutrient: { id: 1004 }, amount: 9.5 },
    { nutrient: { id: 1005 }, amount: 0.7 },
  ],
  foodPortions: [{ amount: 1, modifier: "large", gramWeight: 50 }],
};

let fdcCalls = 0;
const fakeFetch = (async (url: URL) => {
  fdcCalls++;
  if (url.pathname.endsWith("/foods/search")) {
    return new Response(JSON.stringify({ foods: [{ fdcId: EGG.fdcId, description: EGG.description, dataType: "SR Legacy", foodNutrients: [{ nutrientId: 1008, value: 143 }] }] }));
  }
  if (url.pathname.endsWith(`/food/${EGG.fdcId}`)) return new Response(JSON.stringify(EGG));
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
const app = createApp({ prisma, fdc: new FdcClient("TEST", fakeFetch) });
const alice = request.agent(app);
const bob = request.agent(app);

beforeAll(async () => {
  await alice.post("/api/auth/signup").send({ email: "alice@example.com", name: "Alice", password: "password1" }).expect(201);
  await bob.post("/api/auth/signup").send({ email: "Bob@Example.com", name: "Bob", password: "password2" }).expect(201);
});
afterAll(() => prisma.$disconnect());

describe("accounts", () => {
  it("requires login", async () => {
    await request(app).get("/api/recipes").expect(401);
  });

  it("rejects duplicate emails and wrong passwords, and logs in case-insensitively", async () => {
    await request(app).post("/api/auth/signup").send({ email: "alice@example.com", name: "A", password: "password1" }).expect(409);
    await request(app).post("/api/auth/login").send({ email: "bob@example.com", password: "nope" }).expect(401);
    const res = await request(app).post("/api/auth/login").send({ email: "BOB@example.com", password: "password2" }).expect(200);
    expect(res.body.name).toBe("Bob");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("validates sign-up input", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "c@example.com", name: "C", password: "short" }).expect(400);
    expect(res.body.error).toMatch(/password/);
  });
});

describe("recipes, reviews and the daily log", () => {
  let eggId: number;
  let portionId: number;
  let oatsId: number;
  let recipeId: number;

  it("searches USDA and caches a food on first import", async () => {
    const search = await alice.get("/api/foods/search?q=egg").expect(200);
    expect(search.body.usda[0].fdcId).toBe(EGG.fdcId);
    const imported = await alice.post("/api/foods/import").send({ fdcId: EGG.fdcId }).expect(201);
    eggId = imported.body.id;
    portionId = imported.body.portions[0].id;
    expect(imported.body).toMatchObject({ kcal: 143, name: EGG.description });
    const before = fdcCalls;
    await bob.post("/api/foods/import").send({ fdcId: EGG.fdcId }).expect(200);
    expect(fdcCalls).toBe(before);
  });

  it("creates custom foods that show up in search", async () => {
    const res = await alice.post("/api/foods").send({ name: "Rolled oats", kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, fiberG: 10.1 }).expect(201);
    oatsId = res.body.id;
    const search = await bob.get("/api/foods/search?q=oats").expect(200);
    expect(search.body.custom.map((f: any) => f.id)).toContain(oatsId);
  });

  it("computes calories per serving and shares recipes with every user", async () => {
    const res = await alice
      .post("/api/recipes")
      .send({
        name: "Egg oat pancakes",
        servings: 2,
        ingredients: [
          { foodId: eggId, quantity: 2, portionId },
          { foodId: oatsId, quantity: 80 },
        ],
      })
      .expect(201);
    recipeId = res.body.id;
    const detail = await bob.get(`/api/recipes/${recipeId}`).expect(200);
    expect(detail.body.total.kcal).toBe(446);
    expect(detail.body.perServing.kcal).toBe(223);
    expect(detail.body.ingredients[0].grams).toBe(100);
    expect(detail.body.canEdit).toBe(false);
    const list = await bob.get("/api/recipes?q=pancake").expect(200);
    expect(list.body[0]).toMatchObject({ id: recipeId, author: { name: "Alice" }, perServing: { kcal: 223 } });
  });

  it("rejects a portion from another food", async () => {
    await alice.post("/api/recipes").send({ name: "Bad", servings: 1, ingredients: [{ foodId: oatsId, quantity: 1, portionId }] }).expect(400);
  });

  it("only lets the author edit or delete", async () => {
    await bob.put(`/api/recipes/${recipeId}`).send({ name: "Mine now", servings: 1, ingredients: [{ foodId: oatsId, quantity: 10 }] }).expect(403);
    await bob.delete(`/api/recipes/${recipeId}`).expect(403);
  });

  it("lets other users review once, and updates their review", async () => {
    await alice.put(`/api/recipes/${recipeId}/review`).send({ rating: 5 }).expect(403);
    await bob.put(`/api/recipes/${recipeId}/review`).send({ rating: 3, comment: "Filling" }).expect(200);
    await bob.put(`/api/recipes/${recipeId}/review`).send({ rating: 4, comment: "Filling, and the calories look right" }).expect(200);
    const detail = await alice.get(`/api/recipes/${recipeId}`).expect(200);
    expect(detail.body.rating).toEqual({ average: 4, count: 1 });
    expect(detail.body.reviews[0]).toMatchObject({ rating: 4, user: { name: "Bob" } });
    await bob.put(`/api/recipes/${recipeId}/review`).send({ rating: 6 }).expect(400);
  });

  it("logs recipes and foods, totals the day against the goal, and keeps logs private", async () => {
    await bob.put("/api/goal").send({ dailyKcal: 2000, from: "2026-10-01" }).expect(200);
    await bob.post("/api/log").send({ date: "2026-10-03", meal: "breakfast", recipeId, servings: 1.5 }).expect(201);
    const food = await bob.post("/api/log").send({ date: "2026-10-03", meal: "snack", foodId: eggId, quantity: 1, portionId }).expect(201);
    expect(food.body.kcal).toBeCloseTo(71.5);
    const day = await bob.get("/api/log?date=2026-10-03").expect(200);
    expect(day.body.entries).toHaveLength(2);
    expect(day.body.total.kcal).toBe(Math.round(223.1 * 1.5 + 71.5));
    expect(day.body.goal.dailyKcal).toBe(2000);
    const aliceDay = await alice.get("/api/log?date=2026-10-03").expect(200);
    expect(aliceDay.body.entries).toHaveLength(0);
    await alice.delete(`/api/log/${food.body.id}`).expect(404);
  });

  it("keeps logged calories when the recipe changes later", async () => {
    await alice.put(`/api/recipes/${recipeId}`).send({ name: "Egg oat pancakes", servings: 1, ingredients: [{ foodId: oatsId, quantity: 80 }] }).expect(200);
    const day = await bob.get("/api/log?date=2026-10-03").expect(200);
    expect(day.body.entries[0].kcal).toBeCloseTo(223.1 * 1.5);
  });

  it("summarises a date range with zero days filled in", async () => {
    const res = await bob.get("/api/log/summary?from=2026-09-30&to=2026-10-03").expect(200);
    expect(res.body.map((d: any) => d.date)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(res.body[0]).toMatchObject({ kcal: 0, goalKcal: null });
    expect(res.body[3].goalKcal).toBe(2000);
    expect(res.body[3].kcal).toBeGreaterThan(0);
  });
});
