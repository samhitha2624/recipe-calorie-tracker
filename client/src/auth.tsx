import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { getProfile, syncKitchen, type User } from "./api";
import { auth, friendlyError, isOwner, signOut } from "./firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Why the last sign-in didn't work, e.g. a login that isn't the app's owner. */
  error: string | null;
  setUser: (u: User) => void;
  /** Runs a sign-in or set-up step, then checks the result once it has fully finished. */
  run: (action: () => Promise<void>) => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null, setUser: () => {}, run: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<{ user: User | null; loading: boolean; error: string | null }>({ user: null, loading: true, error: null });
  // While an action runs, Firebase reports sign-ins before the app is ready (e.g. before the owner is recorded).
  const busy = useRef(false);

  const check = useCallback(
    async (fbUser: FirebaseUser | null) => {
      qc.clear();
      if (!fbUser) {
        setState((s) => ({ user: null, loading: false, error: s.error }));
        return;
      }
      try {
        if (!(await isOwner(fbUser.uid))) {
          setState({ user: null, loading: false, error: "This login can't use this app." });
          await signOut();
          return;
        }
        await syncKitchen();
        setState({ user: await getProfile(), loading: false, error: null });
      } catch (e) {
        setState({ user: null, loading: false, error: friendlyError(e) });
      }
    },
    [qc],
  );

  useEffect(() => onAuthStateChanged(auth, (u) => !busy.current && check(u)), [check]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      busy.current = true;
      setState((s) => ({ ...s, error: null }));
      try {
        await action();
      } finally {
        busy.current = false;
      }
      await check(auth.currentUser);
    },
    [check],
  );

  const setUser = useCallback((user: User) => setState((s) => ({ ...s, user })), []);
  return <AuthContext.Provider value={{ ...state, setUser, run }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
