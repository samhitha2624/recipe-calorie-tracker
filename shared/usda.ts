// Client for USDA FoodData Central: https://fdc.nal.usda.gov/api-guide
import { estimateKcal } from "./nutrition";

const BASE = "https://api.nal.usda.gov/fdc/v1";

const NUTRIENT = {
  energy: 1008,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
} as const;

export interface FdcSearchHit {
  fdcId: number;
  name: string;
  dataType: string;
  brand: string | null;
  kcalPer100g: number | null;
}

export interface FdcFood {
  fdcId: number;
  name: string;
  dataType: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  kcalEstimated: boolean;
  portions: { label: string; gramWeight: number }[];
}

export type Fetch = typeof fetch;

// Whole-ingredient data types rank above branded products.
const TYPE_RANK: Record<string, number> = { Foundation: 0, "SR Legacy": 1, "Survey (FNDDS)": 2, Branded: 3 };

export class FdcClient {
  // Wrapped so browsers don't reject fetch being called as a method of this class ("Illegal invocation").
  constructor(private apiKey: string, private fetchImpl: Fetch = (input, init) => fetch(input, init)) {}

  private async get(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("api_key", this.apiKey);
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new FdcError(res.status, `FoodData Central returned ${res.status}`);
    return res.json();
  }

  async search(query: string): Promise<FdcSearchHit[]> {
    const data = await this.get("/foods/search", {
      query,
      pageSize: "25",
      dataType: "Foundation,SR Legacy,Survey (FNDDS),Branded",
    });
    const hits: FdcSearchHit[] = (data.foods ?? []).map((f: any) => {
      const byId = new Map<number, number>();
      for (const n of f.foodNutrients ?? []) byId.set(n.nutrientId, n.value);
      const kcal =
        byId.get(NUTRIENT.energy) ?? byId.get(NUTRIENT.energyAtwaterGeneral) ?? byId.get(NUTRIENT.energyAtwaterSpecific) ?? null;
      return {
        fdcId: f.fdcId,
        name: f.description,
        dataType: f.dataType,
        brand: f.brandOwner ?? f.brandName ?? null,
        kcalPer100g: kcal,
      };
    });
    // Stable sort keeps FDC's relevance order within each data type.
    return hits
      .map((h, i) => ({ h, i }))
      .sort((a, b) => (TYPE_RANK[a.h.dataType] ?? 9) - (TYPE_RANK[b.h.dataType] ?? 9) || a.i - b.i)
      .map(({ h }) => h);
  }

  async food(fdcId: number): Promise<FdcFood> {
    return parseFood(await this.get(`/food/${fdcId}`));
  }
}

export class FdcError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parseFood(f: any): FdcFood {
  const byId = new Map<number, number>();
  for (const n of f.foodNutrients ?? []) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const value = n.amount ?? n.value;
    if (id != null && typeof value === "number") byId.set(id, value);
  }
  const proteinG = byId.get(NUTRIENT.protein) ?? 0;
  const carbsG = byId.get(NUTRIENT.carbs) ?? 0;
  const fatG = byId.get(NUTRIENT.fat) ?? 0;
  const reported =
    byId.get(NUTRIENT.energy) ?? byId.get(NUTRIENT.energyAtwaterGeneral) ?? byId.get(NUTRIENT.energyAtwaterSpecific);
  return {
    fdcId: f.fdcId,
    name: f.description,
    dataType: f.dataType,
    kcal: reported ?? estimateKcal(proteinG, carbsG, fatG),
    kcalEstimated: reported == null,
    proteinG,
    carbsG,
    fatG,
    fiberG: byId.get(NUTRIENT.fiber) ?? 0,
    portions: parsePortions(f),
  };
}

function parsePortions(f: any): { label: string; gramWeight: number }[] {
  const out: { label: string; gramWeight: number }[] = [];
  for (const p of f.foodPortions ?? []) {
    if (!(p.gramWeight > 0)) continue;
    let label: string | undefined = p.portionDescription;
    if (!label || /not specified/i.test(label)) {
      const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
      label = [p.amount ?? 1, unit, p.modifier ?? ""].join(" ").replace(/\s+/g, " ").trim();
    }
    out.push({ label, gramWeight: p.gramWeight });
  }
  // Branded foods describe one serving instead of a portion list.
  const unit = String(f.servingSizeUnit ?? "").toLowerCase();
  if (f.servingSize > 0 && (unit === "g" || unit === "grm")) {
    out.push({ label: f.householdServingFullText || `1 serving (${f.servingSize} g)`, gramWeight: f.servingSize });
  }
  return out;
}
