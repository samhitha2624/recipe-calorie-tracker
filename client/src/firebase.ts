// Firebase setup: Authentication for the single login, Firestore for all data.
// With VITE_USE_EMULATORS=true (npm run dev:local) everything talks to the local Firebase emulators instead.
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
} from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: "demo-recipe-calories" } : firebaseConfig);

export const auth = getAuth(app);
// Keeps a copy on this device, so pages open instantly and work offline.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/** Usernames: 3–30 lowercase letters, numbers, dots, dashes or underscores. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const MIN_PASSWORD = 8;

// Firebase logins are email-shaped, so a username is stored as username@<your Firebase domain>. No email is ever sent.
const loginEmail = (username: string) => `${username.trim().toLowerCase()}@${firebaseConfig.authDomain}`;
export const usernameOf = (email: string | null) => email?.split("@")[0] ?? "";

const ownerRef = () => doc(db, "meta", "owner");

/** Whether the one login has been created yet. Read from the server so a fresh install never sees a stale answer. */
export async function isSetUp(): Promise<boolean> {
  return (await getDoc(ownerRef())).exists();
}

/** Creates the one login and claims the app for it. Only works while the app has no owner. */
export async function createLogin(username: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, loginEmail(username), password);
  try {
    await setDoc(ownerRef(), { uid: user.uid, createdAt: serverTimestamp() });
  } catch (e) {
    // Someone set the app up first: don't leave this account signed in.
    await firebaseSignOut(auth);
    throw e;
  }
}

export async function signIn(username: string, password: string) {
  await signInWithEmailAndPassword(auth, loginEmail(username), password);
}

export const signOut = () => firebaseSignOut(auth);

/** Whether the signed-in account is the app's owner. */
export async function isOwner(uid: string): Promise<boolean> {
  const owner = await getDoc(ownerRef());
  return owner.exists() && owner.data().uid === uid;
}

export async function changePassword(current: string, next: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Please sign in again.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

const FRIENDLY: Record<string, string> = {
  "auth/invalid-credential": "Wrong username or password.",
  "auth/wrong-password": "Wrong username or password.",
  "auth/user-not-found": "Wrong username or password.",
  "auth/email-already-in-use": "That username is taken. Pick another.",
  "auth/weak-password": `Use a longer password (at least ${MIN_PASSWORD} characters).`,
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/user-disabled": "This login has been turned off in the Firebase console.",
  "auth/configuration-not-found": "Sign-in isn't set up yet: in the Firebase console, open Authentication, click Get started, then enable Email/Password under Sign-in method.",
  "auth/operation-not-allowed":"Username and password sign-in isn't turned on yet: in the Firebase console, enable Authentication > Sign-in method > Email/Password.",
  "auth/admin-restricted-operation": "New logins are turned off in the Firebase console (Authentication > Settings > User actions).",
  "auth/network-request-failed": "Couldn't reach Firebase. Check your internet connection.",
  "permission-denied": "This login can't use this app.",
  unavailable: "Couldn't reach Firebase. Check your internet connection.",
};

/** A sentence a person can act on, for any Firebase error. */
export function friendlyError(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  return FRIENDLY[code] ?? FRIENDLY[code.replace(/^firestore\//, "")] ?? (err as Error).message ?? "Something went wrong.";
}
