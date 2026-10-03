# Recipe Calories

A private web app for one person: keep your recipes, see calories and macros per serving worked out from each ingredient, and log what you eat each day against a calorie goal. It runs entirely on [Firebase](https://firebase.google.com): Authentication for the login, Firestore for the data, Hosting for the website.

## Features

- **My day** – log foods or recipes to Breakfast, Lunch, Snacks or Dinner, see what's left of your daily goal, and a 7-day chart. Every entry can be edited (amount, meal, day, name, calories).
- **Recipes** – sorted into Breakfast, Lunch, Snacks and Dinner, with calories and macros per serving. Rate them and keep notes for next time.
- **Paste a recipe** – type the ingredients one per line ("2 cups milk", "Onion - 1, chopped", "salt to taste") and the steps. Each line is matched to a food, the calories update as you type, and the recipe is saved in one step.
- **Kitchen items** – about 60 everyday ingredients (milk, curd, rice, atta, dals, oil, ghee, onion…) with calories, macros and cup/spoon/piece weights built in, so "milk" just works.
- **Foods** – change the name, nutrition values or portion weights of any food: kitchen items, foods you add from a label, and foods saved from [USDA FoodData Central](https://fdc.nal.usda.gov/). Recipes update straight away; days you already logged keep their calories.
- **One login** – a username and password. The first time the app opens you create it; after that nobody else can, and only that login can see or change anything.
- **Works offline** – data is kept on your device too, so pages open instantly and changes sync when you're back online.

## Set up Firebase (once)

The project is already connected to the Firebase project `calories-tracker-55de4` (see `client/src/firebase-config.ts` and `.firebaserc`). In the [Firebase console](https://console.firebase.google.com/project/calories-tracker-55de4):

1. **Authentication → Get started → Sign-in method:** enable **Email/Password**.
2. **Firestore Database → Create database:** choose a location near you and start in **production mode**.
3. **Firestore Database → Rules:** replace the rules with the contents of [`firestore.rules`](firestore.rules) and click **Publish**. (Or run `npx firebase login` once, then `npm run deploy:rules`.)

Then start the app (below) and create your username and password on the first screen. Afterwards you can untick **Authentication → Settings → User actions → Enable create (sign-up)** for extra peace of mind.

## Run it

You need [Node.js 20+](https://nodejs.org/).

```sh
npm install
npm run dev          # open http://localhost:5173
```

This uses your real Firebase project. To try things out without touching it, run `npm run dev:local` instead: it starts the Firebase emulators on your computer (needs [Java 21+](https://adoptium.net/)) and the app uses those. Emulator data is wiped when you stop it.

USDA food search uses a shared demo key (about 30 searches an hour). For more, get a free key at https://fdc.nal.usda.gov/api-key-signup and put it in a `.env` file as `VITE_FDC_API_KEY=...` (see `.env.example`).

## Put it online

```sh
npx firebase login   # once
npm run deploy       # builds the app and publishes it with the Firestore rules
```

The app is then live at https://calories-tracker-55de4.web.app.

## Changing or forgetting the password

To change it, click **your name → Change password** in the app.

If you forget it: there's no email behind the username, so the app can't send a reset link. Your data isn't tied to the login, so you can make a new one instead:

1. In the Firebase console, **Authentication → Users**: delete your user.
2. **Firestore Database → Data → meta → owner**: delete that document. (If you turned off sign-ups, turn them back on for a moment.)
3. Open the app. It asks you to create a login again, and all your recipes, foods and logs are still there.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app against your Firebase project, with live reload. |
| `npm run dev:local` | Runs the app against local Firebase emulators (needs Java 21+). |
| `npm run build` | Builds the website into `dist/`. |
| `npm run typecheck` | Checks the TypeScript. |
| `npm test` | Unit tests, then the security-rules tests on the Firestore emulator (needs Java 21+). |
| `npm run deploy` | Builds and publishes the website and the security rules. |

### Project layout

```
client/              The web app (React, Vite, Tailwind)
  src/api.ts         All reading and writing of your data (Firestore)
  src/firebase.ts    Firebase setup and the login
  src/pages/         One file per screen
  src/components/    Food search, dialogs, messages
shared/              Calorie maths, the ingredient-line reader, kitchen items, USDA client
firestore.rules      Who may read and write what (only the owner)
tests/               Unit tests and security-rules tests
```
