import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://app:app@localhost:5432/recipes_test";

// Applies migrations to the test database and empties it before the run.
export default async function setup() {
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: TEST_DB }, stdio: "ignore" });
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
  await prisma.$executeRawUnsafe(
    `TRUNCATE "User", "Session", "Goal", "Food", "FoodPortion", "Recipe", "RecipeIngredient", "Review", "LogEntry" RESTART IDENTITY CASCADE`,
  );
  await prisma.$disconnect();
}
