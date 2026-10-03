import { describe, expect, it } from "vitest";
import { FdcClient, parseFood } from "../server/fdc";

describe("FoodData Central parsing", () => {
  it("reads nutrients and SR Legacy portions", () => {
    const food = parseFood({
      fdcId: 171287,
      description: "Egg, whole, raw, fresh",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrient: { id: 1008 }, amount: 143 },
        { nutrient: { id: 1003 }, amount: 12.56 },
        { nutrient: { id: 1004 }, amount: 9.51 },
        { nutrient: { id: 1005 }, amount: 0.72 },
      ],
      foodPortions: [
        { amount: 1, modifier: "large", gramWeight: 50, measureUnit: { name: "undetermined" } },
        { amount: 1, modifier: "", gramWeight: 0 },
      ],
    });
    expect(food).toMatchObject({ kcal: 143, proteinG: 12.56, fiberG: 0, kcalEstimated: false });
    expect(food.portions).toEqual([{ label: "1 large", gramWeight: 50 }]);
  });

  it("falls back to Atwater energy, then to an estimate", () => {
    const atwater = parseFood({ fdcId: 1, description: "x", dataType: "Foundation", foodNutrients: [{ nutrient: { id: 2047 }, amount: 120 }] });
    expect(atwater).toMatchObject({ kcal: 120, kcalEstimated: false });
    const none = parseFood({
      fdcId: 2,
      description: "y",
      dataType: "Foundation",
      foodNutrients: [
        { nutrient: { id: 1003 }, amount: 10 },
        { nutrient: { id: 1005 }, amount: 20 },
        { nutrient: { id: 1004 }, amount: 5 },
      ],
    });
    expect(none).toMatchObject({ kcal: 165, kcalEstimated: true });
  });

  it("adds a branded serving in grams", () => {
    const food = parseFood({
      fdcId: 3,
      description: "GRANOLA",
      dataType: "Branded",
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 450 }],
      servingSize: 55,
      servingSizeUnit: "g",
      householdServingFullText: "2/3 cup",
    });
    expect(food.portions).toEqual([{ label: "2/3 cup", gramWeight: 55 }]);
  });

  it("ranks whole foods above branded ones and sends the key", async () => {
    let called = "";
    const fake = (async (url: URL) => {
      called = String(url);
      return new Response(
        JSON.stringify({
          foods: [
            { fdcId: 1, description: "EGG BITES", dataType: "Branded", brandOwner: "Acme", foodNutrients: [{ nutrientId: 1008, value: 200 }] },
            { fdcId: 2, description: "Egg, raw", dataType: "SR Legacy", foodNutrients: [{ nutrientId: 1008, value: 143 }] },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const hits = await new FdcClient("KEY", fake).search("egg");
    expect(hits.map((h) => h.fdcId)).toEqual([2, 1]);
    expect(hits[1]).toMatchObject({ brand: "Acme", kcalPer100g: 200 });
    expect(called).toContain("api_key=KEY");
  });
});
