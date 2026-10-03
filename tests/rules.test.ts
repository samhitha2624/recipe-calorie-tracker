// Checks firestore.rules against the Firestore emulator. Run with `npm run test:rules`.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-recipe-calories",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

const as = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const claim = (uid: string) => setDoc(doc(as(uid), "meta/owner"), { uid, createdAt: 1 });

describe("setting up the one login", () => {
  it("lets anyone check whether the app is set up", async () => {
    await assertSucceeds(getDoc(doc(as(null), "meta/owner")));
  });

  it("lets a signed-in account claim the app once, for itself only", async () => {
    await assertFails(setDoc(doc(as(null), "meta/owner"), { uid: "x", createdAt: 1 }));
    await assertFails(setDoc(doc(as("alice"), "meta/owner"), { uid: "bob", createdAt: 1 }));
    await assertFails(setDoc(doc(as("alice"), "meta/owner"), { uid: "alice", createdAt: 1, admin: true }));
    await assertSucceeds(claim("alice"));
    await assertFails(setDoc(doc(as("bob"), "meta/owner"), { uid: "bob", createdAt: 2 }));
    await assertFails(updateDoc(doc(as("alice"), "meta/owner"), { uid: "alice", createdAt: 3 }));
    await assertFails(deleteDoc(doc(as("alice"), "meta/owner")));
  });
});

describe("your data", () => {
  it("is readable and writable only by the owner", async () => {
    await claim("alice");
    const recipe = "recipes/r1";
    await assertSucceeds(setDoc(doc(as("alice"), recipe), { name: "Poha" }));
    await assertSucceeds(getDoc(doc(as("alice"), recipe)));
    for (const path of ["foods/f1", "log/l1", "goals/2026-10-03", "meta/profile"]) {
      await assertSucceeds(setDoc(doc(as("alice"), path), { x: 1 }));
      await assertFails(getDoc(doc(as("bob"), path)));
    }
    await assertFails(getDoc(doc(as("bob"), recipe)));
    await assertFails(setDoc(doc(as("bob"), recipe), { name: "Mine now" }));
    await assertFails(getDoc(doc(as(null), recipe)));
  });

  it("can't be stored before the app is set up", async () => {
    await assertFails(setDoc(doc(as("alice"), "recipes/r1"), { name: "Poha" }));
  });

  it("can't be written anywhere else", async () => {
    await claim("alice");
    await assertFails(setDoc(doc(as("alice"), "other/thing"), { x: 1 }));
    await assertFails(setDoc(doc(as("alice"), "meta/settings"), { x: 1 }));
    await assertFails(setDoc(doc(as("alice"), "recipes/r1/notes/n1"), { x: 1 }));
  });
});
