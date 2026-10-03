// Turns typed ingredient lines ("2 cups milk", "Onion - 1, chopped", "salt to taste") into a food and an amount.
import { ingredientNutrients, rounded, type Nutrients } from "./nutrition";

export type Unit = "g" | "kg" | "oz" | "lb" | "pinch" | "ml" | "l" | "cup" | "tbsp" | "tsp" | "piece" | "slice" | "clove";

const UNIT_WORDS: Record<string, Unit> = {
  g: "g", gm: "g", gms: "g", gr: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  pinch: "pinch", pinches: "pinch",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", ltr: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", no: "piece", nos: "piece", whole: "piece",
  slice: "slice", slices: "slice",
  clove: "clove", cloves: "clove", pod: "clove", pods: "clove",
};
const MASS_GRAMS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6, pinch: 0.3 };
const VOLUME_ML: Partial<Record<Unit, number>> = { ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5 };

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5,
};
const FRACTIONS: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8" };
const NO_AMOUNT = /\b(to taste|as needed|as required|as per taste|for garnish(ing)?|for frying|for greasing|optional)\b/i;

const NUM = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|(?:${Object.keys(WORD_NUMBERS).join("|")})\b)`;
const QTY = String.raw`(${NUM}(?:\s*(?:-|–|to)\s*${NUM})?)`;
const UNIT = String.raw`(${Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).join("|")})\.?(?=[\s,(]|$)`;
const LEADING = new RegExp(String.raw`^${QTY}\s*(?:${UNIT})?\s*(?:of\s+)?(.*)$`, "i");
const TRAILING = new RegExp(String.raw`^(.*?)\s*[-–:]?\s+${QTY}\s*(?:${UNIT})?$`, "i");

export interface ParsedLine {
  quantity: number | null;
  unit: Unit | null;
  name: string;
  note: string;
}

function parseNumber(s: string): number {
  const one = (t: string) => {
    t = t.trim().toLowerCase();
    if (t in WORD_NUMBERS) return WORD_NUMBERS[t];
    return t.split(/\s+/).reduce((sum, part) => {
      const [n, d] = part.split("/");
      return sum + (d ? Number(n) / Number(d) : Number(n));
    }, 0);
  };
  // A range like "1-2" counts as the middle.
  const range = s.split(/\s*(?:-|–|\bto\b)\s*/i).filter(Boolean);
  return range.length === 2 ? (one(range[0]) + one(range[1])) / 2 : one(s);
}

/** Splits one line into amount, unit, name and note. Returns null for blank lines and headings like "Ingredients:". */
export function parseLine(raw: string): ParsedLine | null {
  let line = raw.trim().replace(/^(?:[-*•·▪◦]|\d+[.)])\s+/, "");
  if (!line || /:$/.test(line) || /^ingredients?$/i.test(line)) return null;
  line = line.replace(/(\d)?\s*([½¼¾⅓⅔⅛])/g, (_, whole, f) => (whole ? `${whole} ${FRACTIONS[f]}` : FRACTIONS[f]));

  const notes: string[] = [];
  line = line.replace(/\(([^)]*)\)/g, (_, inner) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });
  const comma = line.search(/,(?!\d)/);
  if (comma >= 0) {
    notes.push(line.slice(comma + 1).trim());
    line = line.slice(0, comma);
  }
  line = line.replace(/\s+/g, " ").trim();

  let quantity: number | null = null;
  let unit: Unit | null = null;
  let name = line;
  const lead = LEADING.exec(line);
  const trail = lead ? null : TRAILING.exec(line);
  if (lead && lead[3].trim()) {
    quantity = parseNumber(lead[1]);
    unit = lead[2] ? UNIT_WORDS[lead[2].toLowerCase()] : null;
    name = lead[3];
  } else if (trail && trail[1].trim()) {
    name = trail[1];
    quantity = parseNumber(trail[2]);
    unit = trail[3] ? UNIT_WORDS[trail[3].toLowerCase()] : null;
  }

  const noAmount = NO_AMOUNT.exec(name);
  if (noAmount) {
    notes.unshift(noAmount[0]);
    name = name.replace(NO_AMOUNT, " ");
  }
  if (quantity !== null && !(quantity > 0)) quantity = null;
  return { quantity, unit, name: name.replace(/\s+/g, " ").trim(), note: notes.filter(Boolean).join(", ") };
}

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

// "tomatoes" matches "tomato", "chillies" matches "chilli", "leaves" matches "leaf".
function sameWord(alias: string, typed: string): boolean {
  return (
    typed === alias ||
    typed === `${alias}s` ||
    typed === `${alias}es` ||
    (alias.endsWith("y") && typed === `${alias.slice(0, -1)}ies`) ||
    (alias.endsWith("f") && typed === `${alias.slice(0, -1)}ves`)
  );
}

export interface Candidate<T> {
  names: string[];
  value: T;
}

/** Finds the candidate whose longest name appears in the text, and returns the leftover words. */
export function matchFood<T>(text: string, candidates: Candidate<T>[]): { value: T; leftover: string } | null {
  const typed = words(text);
  let best: { value: T; start: number; length: number; score: number } | null = null;
  for (const c of candidates) {
    for (const name of c.names) {
      const n = words(name);
      if (!n.length) continue;
      const score = n.join(" ").length;
      if (best && score <= best.score) continue;
      for (let i = 0; i + n.length <= typed.length; i++) {
        if (n.every((w, j) => sameWord(w, typed[i + j]))) {
          best = { value: c.value, start: i, length: n.length, score };
          break;
        }
      }
    }
  }
  if (!best) return null;
  const leftover = [...typed.slice(0, best.start), ...typed.slice(best.start + best.length)].filter((w) => w !== "of");
  return { value: best.value, leftover: leftover.join(" ") };
}

interface PortionLike {
  id: string;
  label: string;
  gramWeight: number;
}
export interface FoodLike extends Nutrients {
  id: string;
  name: string;
  portions: PortionLike[];
}

/** Picks the food portion that is measured in this unit, e.g. "1 cup" or "1 cup, chopped". */
function portionFor(food: FoodLike, unit: Unit): PortionLike | undefined {
  return food.portions.find((p) => words(p.label).some((w) => UNIT_WORDS[w] === unit));
}

/** Converts an amount to what a recipe ingredient stores: a count of a portion, or grams. */
export function toAmount(food: FoodLike, quantity: number, unit: Unit | null): { quantity: number; portionId: string | null } | { error: string } {
  const grams = (n: number) => ({ quantity: Math.round(n * 10) / 10, portionId: null });
  if (unit && MASS_GRAMS[unit]) return grams(quantity * MASS_GRAMS[unit]!);
  const portion = portionFor(food, unit ?? "piece");
  if (portion) return { quantity, portionId: portion.id };
  if (unit && VOLUME_ML[unit]) {
    // Convert through any volume portion the food has, e.g. 100 ml of milk via its 244 g cup.
    for (const p of food.portions) {
      const pUnit = words(p.label).map((w) => UNIT_WORDS[w]).find((u) => u && VOLUME_ML[u]);
      if (pUnit) return grams(((quantity * VOLUME_ML[unit]!) / VOLUME_ML[pUnit]!) * p.gramWeight);
    }
  }
  return unit
    ? { error: `don't know how much 1 ${unit} of ${food.name} weighs; give it in grams` }
    : { error: `how much ${food.name}? Add a unit, e.g. 100 g or 1 cup` };
}

export type LineResult<T extends FoodLike> =
  | { line: string; status: "ok"; food: T; quantity: number; portionId: string | null; note: string; grams: number; nutrients: Nutrients }
  | { line: string; status: "skipped"; food: T | null; note: string }
  | { line: string; status: "unknown" | "error"; message: string };

/** Parses pasted ingredient text, one ingredient per line. */
export function parseIngredients<T extends FoodLike>(text: string, candidates: Candidate<T>[]): LineResult<T>[] {
  const out: LineResult<T>[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const match = matchFood(parsed.name, candidates);
    const note = [match?.leftover, parsed.note].filter(Boolean).join(", ");
    if (parsed.quantity === null) {
      out.push({ line: line.trim(), status: "skipped", food: match?.value ?? null, note });
    } else if (!match) {
      out.push({ line: line.trim(), status: "unknown", message: `couldn't find "${parsed.name}"` });
    } else {
      const amount = toAmount(match.value, parsed.quantity, parsed.unit);
      if ("error" in amount) {
        out.push({ line: line.trim(), status: "error", message: amount.error });
      } else {
        const portionGrams = match.value.portions.find((p) => p.id === amount.portionId)?.gramWeight ?? null;
        const input = { food: match.value, quantity: amount.quantity, portionGrams };
        out.push({
          line: line.trim(),
          status: "ok",
          food: match.value,
          ...amount,
          note,
          grams: Math.round((portionGrams ?? 1) * amount.quantity * 10) / 10,
          nutrients: rounded(ingredientNutrients(input)),
        });
      }
    }
  }
  return out;
}
