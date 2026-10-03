import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { FdcError, type FdcClient } from "../fdc.js";
import { HttpError, idParam, notFound } from "../http.js";

const nutrientsPer100g = {
  kcal: z.number().min(0).max(900),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
  fiberG: z.number().min(0).max(100).default(0),
};
const customFoodBody = z.object({
  name: z.string().trim().min(1).max(120),
  ...nutrientsPer100g,
  portions: z.array(z.object({ label: z.string().trim().min(1).max(60), gramWeight: z.number().positive() })).max(10).default([]),
});

export function foodRoutes(prisma: PrismaClient, fdc: FdcClient) {
  const r = Router();

  // Custom foods matching the query come first, then USDA results.
  r.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json({ custom: [], usda: [] });
      return;
    }
    const custom = await prisma.food.findMany({
      where: { createdById: { not: null }, name: { contains: q, mode: "insensitive" } },
      include: { portions: true },
      take: 10,
    });
    let usda: Awaited<ReturnType<FdcClient["search"]>> = [];
    let usdaError: string | null = null;
    try {
      usda = await fdc.search(q);
    } catch (e) {
      usdaError = e instanceof FdcError && e.status === 429 ? "USDA search is busy, try again shortly" : "USDA search is unavailable right now";
    }
    res.json({ custom, usda, usdaError });
  });

  // Copy a USDA food into our database on first use and return the local copy.
  r.post("/import", async (req, res) => {
    const { fdcId } = z.object({ fdcId: z.number().int().positive() }).parse(req.body);
    const existing = await prisma.food.findUnique({ where: { fdcId }, include: { portions: true } });
    if (existing) {
      res.json(existing);
      return;
    }
    let food;
    try {
      food = await fdc.food(fdcId);
    } catch (e) {
      if (e instanceof FdcError && e.status === 404) throw notFound("That USDA food doesn't exist");
      throw new HttpError(502, "Couldn't reach USDA FoodData Central");
    }
    const { portions, ...fields } = food;
    const saved = await prisma.food.upsert({
      where: { fdcId },
      update: {},
      create: { ...fields, portions: { create: portions } },
      include: { portions: true },
    });
    res.status(201).json(saved);
  });

  r.post("/", async (req, res) => {
    const { portions, ...fields } = customFoodBody.parse(req.body);
    const food = await prisma.food.create({
      data: { ...fields, dataType: "Custom", createdById: req.user!.id, portions: { create: portions } },
      include: { portions: true },
    });
    res.status(201).json(food);
  });

  r.get("/:id", async (req, res) => {
    const food = await prisma.food.findUnique({ where: { id: idParam(req.params.id) }, include: { portions: true } });
    if (!food) throw notFound();
    res.json(food);
  });

  return r;
}
