# Recipe Calories

A web app where people share recipes, see calories and macros per serving computed from each ingredient, review each other's recipes, and track what they eat each day against a calorie goal.

- **Accounts:** anyone can sign up with email and password. Recipes and reviews are shared with everyone; food logs and goals are private.
- **Recipes:** build a recipe from searched ingredients and see calories per serving update as you type. Only the author can edit or delete it.
- **Reviews:** rate other people's recipes 1 to 5 stars with a comment. One review per person per recipe, editable.
- **My day:** log recipes (by servings) or single foods (by grams or portion) to breakfast, lunch, dinner or snacks, see the total against your goal, and a 7-day chart.
- **Nutrition data:** [USDA FoodData Central](https://fdc.nal.usda.gov/) (public domain). A food is copied into the database the first time someone uses it. Users can also add their own foods from a label.

Design doc: https://claude.ai/code/artifact/81a74289-d24a-4c54-ae24-f26c7687dd9a

## Stack

React + Vite + Tailwind on the front end, Express + Prisma + PostgreSQL on the back end, all TypeScript. The calorie math lives in `shared/nutrition.ts` and is used by both.

## Run it locally

You need Node 20+ and PostgreSQL.

```sh
cp .env.example .env            # then edit DATABASE_URL and FDC_API_KEY
npm install
npx prisma migrate deploy       # create the tables
npm run dev                     # API on :3000, web app on http://localhost:5173
```

Get a free USDA API key at https://fdc.nal.usda.gov/api-key-signup. Without one the app uses `DEMO_KEY`, which allows only 30 searches an hour.

## Tests

```sh
npm test            # needs a Postgres database for the API tests
npm run typecheck
```

The API tests use `TEST_DATABASE_URL` (default `postgresql://app:app@localhost:5432/recipes_test`) and empty it before each run, so don't point it at real data.

## Deploy

`render.yaml` sets up a Render web service plus a Postgres database. In Render choose New > Blueprint, pick this repo, and set `FDC_API_KEY` when asked. Any host works: run `npm run build`, `npx prisma migrate deploy`, then `npm start` with `NODE_ENV=production` and `DATABASE_URL` set.
