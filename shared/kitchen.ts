// Built-in kitchen items, so "2 cups milk" works without searching USDA.
// Values are per 100 g, mostly from USDA FoodData Central (SR Legacy); unit weights are typical household
// measures. The app copies missing items into your foods when you sign in but never overwrites ones you
// already have, so changes made on the Foods page stick. Items added to this list appear on the next sign-in.

/** Household units a kitchen item can be measured in, with grams per one unit. */
export type KitchenUnit = "cup" | "tbsp" | "tsp" | "piece" | "slice" | "clove";

export interface KitchenItem {
  key: string;
  name: string;
  /** What people type for it. The longest alias found in an ingredient line wins. */
  aliases: string[];
  /** kcal, protein g, carbs g, fat g, fiber g per 100 g. */
  per100g: [number, number, number, number, number];
  /** Grams in one unit. tbsp and tsp are derived from cup when not given. */
  units: Partial<Record<KitchenUnit, number>>;
}

export const KITCHEN: KitchenItem[] = [
  // Dairy and eggs
  { key: "milk-whole", name: "Milk, whole", aliases: ["milk", "whole milk", "full cream milk", "full fat milk"], per100g: [61, 3.2, 4.8, 3.3, 0], units: { cup: 244 } },
  { key: "milk-toned", name: "Milk, toned (3% fat)", aliases: ["toned milk", "double toned milk", "low fat milk"], per100g: [58, 3.1, 4.7, 3.0, 0], units: { cup: 244 } },
  { key: "milk-skim", name: "Milk, skimmed", aliases: ["skim milk", "skimmed milk", "nonfat milk", "fat free milk"], per100g: [34, 3.4, 5.0, 0.1, 0], units: { cup: 245 } },
  { key: "curd", name: "Curd / plain yogurt", aliases: ["curd", "dahi", "yogurt", "yoghurt", "plain yogurt", "thick curd"], per100g: [61, 3.5, 4.7, 3.3, 0], units: { cup: 245 } },
  { key: "paneer", name: "Paneer", aliases: ["paneer", "cottage cheese"], per100g: [265, 18.3, 1.2, 20.8, 0], units: { cup: 150 } },
  { key: "cheese", name: "Cheese, cheddar", aliases: ["cheese", "cheddar", "cheddar cheese", "grated cheese"], per100g: [403, 24.9, 1.3, 33.1, 0], units: { cup: 113, slice: 28 } },
  { key: "cream", name: "Fresh cream", aliases: ["cream", "fresh cream", "heavy cream", "malai"], per100g: [340, 2.8, 2.7, 36.1, 0], units: { cup: 238 } },
  { key: "butter", name: "Butter", aliases: ["butter", "salted butter", "unsalted butter"], per100g: [717, 0.9, 0.1, 81.1, 0], units: { cup: 227, tbsp: 14.2, tsp: 4.7 } },
  { key: "ghee", name: "Ghee", aliases: ["ghee", "clarified butter"], per100g: [876, 0.3, 0, 99.5, 0], units: { cup: 205, tbsp: 12.8, tsp: 4.3 } },
  { key: "egg", name: "Egg, whole", aliases: ["egg", "whole egg"], per100g: [143, 12.6, 0.7, 9.5, 0], units: { piece: 50 } },
  { key: "egg-white", name: "Egg white", aliases: ["egg white"], per100g: [52, 10.9, 0.7, 0.2, 0], units: { piece: 33 } },

  // Grains, flours and cereals (raw / dry)
  { key: "rice-white", name: "Rice, white, raw", aliases: ["rice", "white rice", "raw rice", "basmati rice", "basmati", "sona masoori rice", "sona masoori"], per100g: [365, 7.1, 80.0, 0.7, 1.3], units: { cup: 185 } },
  { key: "rice-brown", name: "Rice, brown, raw", aliases: ["brown rice"], per100g: [367, 7.5, 76.2, 3.2, 3.6], units: { cup: 185 } },
  { key: "rice-cooked", name: "Rice, white, cooked", aliases: ["cooked rice", "steamed rice", "boiled rice", "leftover rice"], per100g: [130, 2.7, 28.2, 0.3, 0.4], units: { cup: 158 } },
  { key: "atta", name: "Whole wheat flour (atta)", aliases: ["atta", "wheat flour", "whole wheat flour", "chapati flour", "gehu atta"], per100g: [340, 13.2, 72.0, 2.5, 10.7], units: { cup: 120 } },
  { key: "maida", name: "All-purpose flour (maida)", aliases: ["maida", "flour", "all purpose flour", "plain flour", "refined flour"], per100g: [364, 10.3, 76.3, 1.0, 2.7], units: { cup: 125 } },
  { key: "besan", name: "Gram flour (besan)", aliases: ["besan", "gram flour", "chickpea flour", "kadalai maavu", "senaga pindi"], per100g: [387, 22.4, 57.8, 6.7, 10.8], units: { cup: 92 } },
  { key: "rava", name: "Semolina (rava / sooji)", aliases: ["rava", "sooji", "suji", "semolina", "bombay rava", "upma rava"], per100g: [360, 12.7, 72.8, 1.1, 3.9], units: { cup: 167 } },
  { key: "poha", name: "Poha (flattened rice)", aliases: ["poha", "flattened rice", "aval", "atukulu", "beaten rice"], per100g: [346, 6.6, 76.9, 1.2, 0.9], units: { cup: 70 } },
  { key: "oats", name: "Oats, rolled", aliases: ["oats", "rolled oats", "oatmeal", "quick oats"], per100g: [379, 13.2, 67.7, 6.5, 10.1], units: { cup: 81 } },
  { key: "bread-white", name: "Bread, white", aliases: ["bread", "white bread", "bread slice"], per100g: [266, 7.6, 50.6, 3.3, 2.4], units: { slice: 25 } },
  { key: "bread-brown", name: "Bread, whole wheat", aliases: ["brown bread", "whole wheat bread", "wheat bread", "multigrain bread"], per100g: [252, 12.4, 42.7, 3.5, 6.0], units: { slice: 32 } },

  // Dals and legumes (dry)
  { key: "toor-dal", name: "Toor dal (pigeon peas), dry", aliases: ["toor dal", "tur dal", "arhar dal", "kandi pappu", "pigeon peas", "dal"], per100g: [343, 21.7, 62.8, 1.5, 15.0], units: { cup: 205 } },
  { key: "moong-dal", name: "Moong dal, dry", aliases: ["moong dal", "mung dal", "moong", "green gram", "pesarapappu", "pesalu", "mung beans"], per100g: [347, 23.9, 62.6, 1.2, 16.3], units: { cup: 207 } },
  { key: "chana-dal", name: "Chana dal / chickpeas, dry", aliases: ["chana dal", "chana", "chickpeas", "chole", "kabuli chana", "bengal gram", "senagapappu"], per100g: [378, 20.5, 63.0, 6.0, 12.2], units: { cup: 200 } },
  { key: "urad-dal", name: "Urad dal, dry", aliases: ["urad dal", "urad", "black gram", "minapappu"], per100g: [341, 25.2, 59.0, 1.6, 18.3], units: { cup: 200 } },
  { key: "masoor-dal", name: "Masoor dal (red lentils), dry", aliases: ["masoor dal", "masoor", "red lentils", "lentils"], per100g: [352, 24.6, 63.4, 1.1, 10.7], units: { cup: 192 } },
  { key: "rajma", name: "Rajma (kidney beans), dry", aliases: ["rajma", "kidney beans", "red kidney beans"], per100g: [333, 23.6, 60.0, 0.8, 24.9], units: { cup: 184 } },

  // Vegetables (raw)
  { key: "onion", name: "Onion", aliases: ["onion", "red onion", "big onion"], per100g: [40, 1.1, 9.3, 0.1, 1.7], units: { piece: 110, cup: 160 } },
  { key: "tomato", name: "Tomato", aliases: ["tomato"], per100g: [18, 0.9, 3.9, 0.2, 1.2], units: { piece: 123, cup: 180 } },
  { key: "potato", name: "Potato", aliases: ["potato", "aloo"], per100g: [77, 2.0, 17.5, 0.1, 2.1], units: { piece: 213, cup: 150 } },
  { key: "garlic", name: "Garlic", aliases: ["garlic", "garlic clove", "garlic pod", "lahsun"], per100g: [149, 6.4, 33.1, 0.5, 2.1], units: { clove: 3, tbsp: 8.5, tsp: 2.8 } },
  { key: "ginger", name: "Ginger", aliases: ["ginger", "adrak", "ginger garlic paste"], per100g: [80, 1.8, 17.8, 0.8, 2.0], units: { tbsp: 6, tsp: 2, piece: 5 } },
  { key: "green-chili", name: "Green chilli", aliases: ["green chilli", "green chili", "chilli", "chili", "mirchi", "hari mirch"], per100g: [40, 2.0, 9.5, 0.2, 1.5], units: { piece: 5 } },
  { key: "carrot", name: "Carrot", aliases: ["carrot", "gajar"], per100g: [41, 0.9, 9.6, 0.2, 2.8], units: { piece: 61, cup: 128 } },
  { key: "peas", name: "Green peas", aliases: ["peas", "green peas", "matar", "frozen peas"], per100g: [81, 5.4, 14.5, 0.4, 5.7], units: { cup: 145 } },
  { key: "spinach", name: "Spinach", aliases: ["spinach", "palak"], per100g: [23, 2.9, 3.6, 0.4, 2.2], units: { cup: 30 } },
  { key: "cauliflower", name: "Cauliflower", aliases: ["cauliflower", "gobi"], per100g: [25, 1.9, 5.0, 0.3, 2.0], units: { cup: 107 } },
  { key: "cabbage", name: "Cabbage", aliases: ["cabbage", "patta gobi"], per100g: [25, 1.3, 5.8, 0.1, 2.5], units: { cup: 89 } },
  { key: "capsicum", name: "Capsicum (bell pepper)", aliases: ["capsicum", "bell pepper", "green capsicum", "shimla mirch"], per100g: [20, 0.9, 4.6, 0.2, 1.7], units: { piece: 119, cup: 149 } },
  { key: "coriander", name: "Coriander leaves", aliases: ["coriander", "coriander leaves", "cilantro", "kothimeera", "dhania"], per100g: [23, 2.1, 3.7, 0.5, 2.8], units: { cup: 16 } },
  { key: "coconut", name: "Coconut, fresh grated", aliases: ["coconut", "grated coconut", "fresh coconut"], per100g: [354, 3.3, 15.2, 33.5, 9.0], units: { cup: 80 } },
  { key: "lemon-juice", name: "Lemon juice", aliases: ["lemon juice", "lime juice", "lemon", "lime"], per100g: [22, 0.4, 6.9, 0.2, 0.3], units: { cup: 244, piece: 30 } },

  // Fruit
  { key: "banana", name: "Banana", aliases: ["banana"], per100g: [89, 1.1, 22.8, 0.3, 2.6], units: { piece: 118 } },
  { key: "apple", name: "Apple", aliases: ["apple"], per100g: [52, 0.3, 13.8, 0.2, 2.4], units: { piece: 182 } },

  // Meat
  { key: "chicken", name: "Chicken, meat only, raw", aliases: ["chicken", "boneless chicken", "chicken pieces"], per100g: [119, 21.4, 0, 3.1, 0], units: {} },
  { key: "chicken-breast", name: "Chicken breast, skinless, raw", aliases: ["chicken breast"], per100g: [120, 22.5, 0, 2.6, 0], units: { piece: 174 } },
  { key: "mutton", name: "Mutton (goat), raw", aliases: ["mutton", "goat", "goat meat", "lamb"], per100g: [109, 20.6, 0, 2.3, 0], units: {} },

  // Nuts
  { key: "peanuts", name: "Peanuts", aliases: ["peanut", "groundnut", "palli"], per100g: [567, 25.8, 16.1, 49.2, 8.5], units: { cup: 146 } },
  { key: "cashews", name: "Cashews", aliases: ["cashew", "cashew nut", "kaju"], per100g: [553, 18.2, 30.2, 43.9, 3.3], units: { cup: 137, piece: 1.6 } },
  { key: "almonds", name: "Almonds", aliases: ["almond", "badam"], per100g: [579, 21.2, 21.6, 49.9, 12.5], units: { cup: 143, piece: 1.2 } },

  // Oils, sweeteners, seasoning
  { key: "oil", name: "Cooking oil (sunflower / vegetable)", aliases: ["oil", "cooking oil", "sunflower oil", "vegetable oil", "refined oil", "groundnut oil", "peanut oil", "mustard oil", "sesame oil"], per100g: [884, 0, 0, 100, 0], units: { cup: 218, tbsp: 13.6, tsp: 4.5 } },
  { key: "olive-oil", name: "Olive oil", aliases: ["olive oil", "extra virgin olive oil"], per100g: [884, 0, 0, 100, 0], units: { cup: 216, tbsp: 13.5, tsp: 4.5 } },
  { key: "coconut-oil", name: "Coconut oil", aliases: ["coconut oil"], per100g: [892, 0, 0, 99.1, 0], units: { cup: 218, tbsp: 13.6, tsp: 4.5 } },
  { key: "sugar", name: "Sugar", aliases: ["sugar", "white sugar", "granulated sugar", "chini"], per100g: [387, 0, 100, 0, 0], units: { cup: 200, tbsp: 12.5, tsp: 4.2 } },
  { key: "jaggery", name: "Jaggery", aliases: ["jaggery", "gur", "bellam"], per100g: [383, 0.4, 98.0, 0.1, 0], units: { cup: 200, tbsp: 12.5, tsp: 4.2 } },
  { key: "honey", name: "Honey", aliases: ["honey"], per100g: [304, 0.3, 82.4, 0, 0.2], units: { cup: 339, tbsp: 21, tsp: 7 } },
  { key: "salt", name: "Salt", aliases: ["salt", "table salt", "rock salt"], per100g: [0, 0, 0, 0, 0], units: { tbsp: 18, tsp: 6 } },
  { key: "water", name: "Water", aliases: ["water", "hot water", "warm water"], per100g: [0, 0, 0, 0, 0], units: { cup: 237 } },
  { key: "cumin", name: "Cumin seeds", aliases: ["cumin", "cumin seeds", "jeera", "jeera seeds"], per100g: [375, 17.8, 44.2, 22.3, 10.5], units: { tbsp: 6, tsp: 2.1 } },
  { key: "mustard-seeds", name: "Mustard seeds", aliases: ["mustard seeds", "mustard", "rai", "avalu"], per100g: [508, 26.1, 28.1, 36.2, 12.2], units: { tbsp: 11, tsp: 3.3 } },
  { key: "turmeric", name: "Turmeric powder", aliases: ["turmeric", "turmeric powder", "haldi", "pasupu"], per100g: [312, 9.7, 67.1, 3.3, 22.7], units: { tbsp: 9.4, tsp: 3 } },
  { key: "chili-powder", name: "Red chilli powder", aliases: ["chilli powder", "chili powder", "red chilli powder", "red chili powder", "lal mirch", "karam"], per100g: [282, 13.5, 49.7, 14.3, 34.8], units: { tbsp: 8, tsp: 2.7 } },
];

/** Portions to store for an item: its own units, plus tbsp and tsp derived from cup. */
export function kitchenPortions(item: KitchenItem): { label: string; gramWeight: number }[] {
  const units = { ...item.units };
  if (units.cup && !units.tbsp) units.tbsp = Math.round((units.cup / 16) * 10) / 10;
  if (units.cup && !units.tsp) units.tsp = Math.round((units.cup / 48) * 10) / 10;
  return Object.entries(units).map(([unit, gramWeight]) => ({ label: `1 ${unit}`, gramWeight }));
}

/** Kitchen items whose name or an alias contains the search text. */
export function searchKitchen(q: string): KitchenItem[] {
  const s = q.toLowerCase();
  return KITCHEN.filter((k) => k.name.toLowerCase().includes(s) || k.aliases.some((a) => a.includes(s)));
}
