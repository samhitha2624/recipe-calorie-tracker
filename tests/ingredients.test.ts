import { describe, expect, it } from "vitest";
import { matchFood, parseIngredients, parseLine, toAmount, type FoodLike } from "../shared/ingredients";
import { KITCHEN, kitchenPortions, searchKitchen } from "../shared/kitchen";

// The kitchen list as the database would hold it, with made-up ids.
let nextId = 1;
const newId = () => String(nextId++);
const foods = KITCHEN.map((k) => {
  const [kcal, proteinG, carbsG, fatG, fiberG] = k.per100g;
  const food: FoodLike & { key: string } = {
    id: newId(),
    key: k.key,
    name: k.name,
    kcal, proteinG, carbsG, fatG, fiberG,
    portions: kitchenPortions(k).map((p) => ({ ...p, id: newId() })),
  };
  return { names: k.aliases, value: food };
});
const keyOf = (text: string) => matchFood(text, foods)?.value.key;

describe("parseLine", () => {
  it.each([
    ["2 cups milk", { quantity: 2, unit: "cup", name: "milk", note: "" }],
    ["200ml milk", { quantity: 200, unit: "ml", name: "milk" }],
    ["1 1/2 tbsp oil", { quantity: 1.5, unit: "tbsp", name: "oil" }],
    ["½ cup sugar", { quantity: 0.5, unit: "cup", name: "sugar" }],
    ["1½ cups rava", { quantity: 1.5, unit: "cup", name: "rava" }],
    ["2 onions, finely chopped", { quantity: 2, unit: null, name: "onions", note: "finely chopped" }],
    ["Onion - 1 (big)", { quantity: 1, unit: null, name: "Onion", note: "big" }],
    ["Rice: 1 cup", { quantity: 1, unit: "cup", name: "Rice" }],
    ["Tomatoes - 2 nos", { quantity: 2, unit: "piece", name: "Tomatoes" }],
    ["a pinch of salt", { quantity: 1, unit: "pinch", name: "salt" }],
    ["1-2 green chillies", { quantity: 1.5, unit: null, name: "green chillies" }],
    ["- 3 cloves garlic", { quantity: 3, unit: "clove", name: "garlic" }],
    ["1 large egg", { quantity: 1, unit: null, name: "large egg" }],
    ["Salt to taste", { quantity: null, name: "Salt", note: "to taste" }],
    ["apple 2", { quantity: 2, unit: null, name: "apple" }],
  ])("%s", (line, expected) => {
    expect(parseLine(line)).toMatchObject(expected);
  });

  it("ignores blank lines and headings", () => {
    expect(parseLine("   ")).toBeNull();
    expect(parseLine("Ingredients:")).toBeNull();
    expect(parseLine("For the tadka:")).toBeNull();
  });
});

describe("matching kitchen items", () => {
  it("finds what people type, preferring the longest name", () => {
    expect(keyOf("milk")).toBe("milk-whole");
    expect(keyOf("toned milk")).toBe("milk-toned");
    expect(keyOf("olive oil")).toBe("olive-oil");
    expect(keyOf("oil")).toBe("oil");
    expect(keyOf("green chillies")).toBe("green-chili");
    expect(keyOf("red chilli powder")).toBe("chili-powder");
    expect(keyOf("tomatoes")).toBe("tomato");
    expect(keyOf("Basmati rice")).toBe("rice-white");
    expect(keyOf("dragonfruit")).toBeUndefined();
  });

  it("keeps the other words as a note", () => {
    expect(matchFood("large ripe tomatoes", foods)?.leftover).toBe("large ripe");
  });

  it("has unique keys and aliases", () => {
    expect(new Set(KITCHEN.map((k) => k.key)).size).toBe(KITCHEN.length);
    const aliases = KITCHEN.flatMap((k) => k.aliases);
    expect(aliases.filter((a, i) => aliases.indexOf(a) !== i)).toEqual([]);
  });

  it("searches by alias", () => {
    expect(searchKitchen("dahi").map((k) => k.key)).toEqual(["curd"]);
  });
});

describe("amounts", () => {
  const milk = foods.find((f) => f.value.key === "milk-whole")!.value;
  const egg = foods.find((f) => f.value.key === "egg")!.value;
  const chicken = foods.find((f) => f.value.key === "chicken")!.value;

  it("uses a matching portion, converts mass to grams and volume through a portion", () => {
    expect(toAmount(milk, 2, "cup")).toEqual({ quantity: 2, portionId: milk.portions.find((p) => p.label === "1 cup")!.id });
    expect(toAmount(milk, 1, "kg")).toEqual({ quantity: 1000, portionId: null });
    expect(toAmount(milk, 120, "ml")).toEqual({ quantity: 122, portionId: null });
    expect(toAmount(egg, 2, null)).toMatchObject({ quantity: 2 });
  });

  it("explains amounts it can't convert", () => {
    expect(toAmount(chicken, 1, "cup")).toHaveProperty("error");
    expect(toAmount(chicken, 2, null)).toHaveProperty("error");
  });
});

describe("parseIngredients", () => {
  it("parses a pasted list into ingredients with calories", () => {
    const lines = parseIngredients(
      ["Ingredients:", "2 cups milk", "1 egg", "Salt to taste", "1 tbsp dragonfruit jam", "", "1 cup chicken"].join("\n"),
      foods,
    );
    expect(lines.map((l) => l.status)).toEqual(["ok", "ok", "skipped", "unknown", "error"]);
    const [milk, egg] = lines;
    expect(milk).toMatchObject({ grams: 488, nutrients: { kcal: 298 } });
    expect(egg).toMatchObject({ grams: 50, nutrients: { kcal: 72 } });
  });
});
