// Nutrition math shared by the API and the browser. All food values are per 100 g.

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface IngredientInput {
  food: Nutrients;
  quantity: number;
  /** Gram weight of one unit of the chosen portion; null means quantity is in grams. */
  portionGrams: number | null;
}

export const ZERO: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
const KEYS = Object.keys(ZERO) as (keyof Nutrients)[];

export function gramsOf(quantity: number, portionGrams: number | null): number {
  return portionGrams == null ? quantity : quantity * portionGrams;
}

export function scale(n: Nutrients, factor: number): Nutrients {
  const out = { ...ZERO };
  for (const k of KEYS) out[k] = n[k] * factor;
  return out;
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...ZERO };
  for (const k of KEYS) out[k] = a[k] + b[k];
  return out;
}

export function ingredientNutrients(i: IngredientInput): Nutrients {
  return scale(i.food, gramsOf(i.quantity, i.portionGrams) / 100);
}

export function recipeTotals(ingredients: IngredientInput[]): Nutrients {
  return ingredients.map(ingredientNutrients).reduce(add, ZERO);
}

export function perServing(total: Nutrients, servings: number): Nutrients {
  if (!(servings > 0)) throw new Error("servings must be positive");
  return scale(total, 1 / servings);
}

/** Atwater estimate used when a food has no reported energy value. */
export function estimateKcal(proteinG: number, carbsG: number, fatG: number): number {
  return 4 * proteinG + 4 * carbsG + 9 * fatG;
}

/** Display rounding: whole kcal, macros to 0.1 g. Sum first, round last. */
export function rounded(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    proteinG: Math.round(n.proteinG * 10) / 10,
    carbsG: Math.round(n.carbsG * 10) / 10,
    fatG: Math.round(n.fatG * 10) / 10,
    fiberG: Math.round(n.fiberG * 10) / 10,
  };
}
