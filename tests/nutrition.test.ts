import { describe, expect, it } from "vitest";
import { estimateKcal, gramsOf, ingredientNutrients, perServing, recipeTotals, rounded } from "../shared/nutrition";

const egg = { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, fiberG: 0 };
const oats = { kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, fiberG: 10.1 };

describe("nutrition", () => {
  it("converts portions to grams", () => {
    expect(gramsOf(2, 50)).toBe(100);
    expect(gramsOf(30, null)).toBe(30);
  });

  it("scales per-100 g values by weight", () => {
    expect(ingredientNutrients({ food: egg, quantity: 2, portionGrams: 50 })).toEqual(egg);
    expect(ingredientNutrients({ food: oats, quantity: 40, portionGrams: null }).kcal).toBeCloseTo(151.6);
  });

  it("sums a recipe and divides by servings", () => {
    const total = recipeTotals([
      { food: egg, quantity: 2, portionGrams: 50 },
      { food: oats, quantity: 80, portionGrams: null },
    ]);
    expect(total.kcal).toBeCloseTo(143 + 303.2);
    expect(perServing(total, 2).kcal).toBeCloseTo(223.1);
    expect(() => perServing(total, 0)).toThrow();
  });

  it("rounds only for display", () => {
    expect(rounded({ kcal: 223.1, proteinG: 12.55, carbsG: 0.04, fatG: 9.96, fiberG: 0 })).toEqual({
      kcal: 223,
      proteinG: 12.6,
      carbsG: 0,
      fatG: 10,
      fiberG: 0,
    });
  });

  it("estimates energy with Atwater factors", () => {
    expect(estimateKcal(10, 20, 5)).toBe(165);
  });
});
