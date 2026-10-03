import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};

/** Parses a positive integer route param or throws 404. */
export function idParam(value: string | string[] | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw notFound();
  return n;
}

/** "YYYY-MM-DD" -> Date at UTC midnight, matching Postgres DATE columns. */
export function parseDay(s: unknown): Date {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "date must be YYYY-MM-DD");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "date must be YYYY-MM-DD");
  return d;
}

export const formatDay = (d: Date) => d.toISOString().slice(0, 10);
