import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import type { PrismaClient } from "@prisma/client";
import { authRoutes, loadUser, requireUser } from "./auth.js";
import type { FdcClient } from "./fdc.js";
import { errorHandler } from "./http.js";
import { foodRoutes } from "./routes/foods.js";
import { goalRoutes, logRoutes } from "./routes/log.js";
import { recipeRoutes } from "./routes/recipes.js";

export function createApp({ prisma, fdc, serveClient = false }: { prisma: PrismaClient; fdc: FdcClient; serveClient?: boolean }) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(loadUser(prisma));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRoutes(prisma));
  app.use("/api/foods", requireUser, foodRoutes(prisma, fdc));
  app.use("/api/recipes", requireUser, recipeRoutes(prisma));
  app.use("/api/log", requireUser, logRoutes(prisma));
  app.use("/api/goal", requireUser, goalRoutes(prisma));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (serveClient) {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");
    app.use(express.static(dir));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(dir, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
