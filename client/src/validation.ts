// Checks data before it's saved and explains problems in plain words.
import type { core, ZodType } from "zod";

const FIELD_NAMES: Record<string, string> = {
  kcal: "Calories",
  dailyKcal: "Daily calories",
  proteinG: "Protein",
  carbsG: "Carbs",
  fatG: "Fat",
  fiberG: "Fiber",
  gramWeight: "Grams",
  label: "Portion name",
  imageUrl: "Photo URL",
  servings: "Servings",
  quantity: "Amount",
};

/** ["ingredients", 2, "quantity"] -> "Ingredient 3: Amount". */
function fieldName(path: PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (typeof path[i + 1] === "number") {
      parts.push(`${String(key).replace(/s$/, "").replace(/^\w/, (c) => c.toUpperCase())} ${(path[i + 1] as number) + 1}`);
      i++;
    } else {
      parts.push(FIELD_NAMES[String(key)] ?? String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase()));
    }
  }
  return parts.join(": ");
}

/** Turns a validation problem into a sentence a person can act on. Custom messages are kept as they are. */
function describeIssue(issue: core.$ZodIssue): string {
  const field = fieldName(issue.path) || "Value";
  if (!/^(Too small|Too big|Invalid)/.test(issue.message)) return issue.path.length ? `${field}: ${issue.message}` : issue.message;
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") return Number(issue.minimum) <= 1 ? `${field} is required` : `${field} must be at least ${issue.minimum} characters`;
      if (issue.origin === "array") return `${field} needs at least ${issue.minimum}`;
      return `${field} must be ${issue.inclusive ? "at least" : "more than"} ${issue.minimum}`;
    case "too_big":
      if (issue.origin === "string") return `${field} must be at most ${issue.maximum} characters`;
      if (issue.origin === "array") return `${field} can have at most ${issue.maximum}`;
      return `${field} must be ${issue.inclusive ? "at most" : "less than"} ${issue.maximum}`;
    case "invalid_type":
      return issue.expected === "int" ? `${field} must be a whole number` : `${field} is missing or not valid`;
    case "invalid_value":
      return `${field} must be one of: ${issue.values.join(", ")}`;
    case "invalid_format":
      return `${field} isn't a valid ${issue.format === "url" ? "web address" : issue.format}`;
    default:
      return `${field} isn't valid`;
  }
}

/** Parses `data` with `schema`, or throws an Error whose message lists every problem. */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map(describeIssue).join(". "));
}

/** "YYYY-MM-DD" that is a real calendar day. */
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
