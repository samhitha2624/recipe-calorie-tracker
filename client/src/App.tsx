import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { setName } from "./api";
import { useAuth } from "./auth";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { usePrompt, useToast } from "./components/feedback";
import { Loading } from "./components/ui";
import { signOut } from "./firebase";
import AuthPage from "./pages/AuthPage";
import FoodEditor from "./pages/FoodEditor";
import FoodsPage from "./pages/FoodsPage";
import RecipesPage from "./pages/RecipesPage";
import RecipePage from "./pages/RecipePage";
import RecipeEditor from "./pages/RecipeEditor";
import PasteRecipe from "./pages/PasteRecipe";
import TrackerPage from "./pages/TrackerPage";

const NAV = [
  { to: "/tracker", label: "My day" },
  { to: "/recipes", label: "Recipes" },
  { to: "/foods", label: "Foods" },
];

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  if (!user) return <AuthPage />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/tracker" className="flex items-center gap-2 text-lg font-semibold text-emerald-800">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            Recipe Calories
          </NavLink>
          <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>
            ))}
          </nav>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeEditor />} />
          <Route path="/recipes/paste" element={<PasteRecipe />} />
          <Route path="/recipes/:id" element={<RecipePage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/foods/new" element={<FoodEditor />} />
          <Route path="/foods/:id" element={<FoodEditor />} />
          <Route path="*" element={<Navigate to="/tracker" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/** Your name, with a menu to rename, change password or sign out. */
function AccountMenu() {
  const { user, setUser } = useAuth();
  const prompt = usePrompt();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  async function rename() {
    setOpen(false);
    const name = await prompt({ title: "Your name", label: "Shown in the top bar", initial: user!.name, confirmLabel: "Save" });
    if (!name || name === user!.name) return;
    try {
      setUser(await setName(name));
      toast("Name updated");
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    }
  }

  const item = "block w-full rounded-md px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";
  return (
    <div className="relative ml-auto" ref={menu}>
      <button
        className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-1 pr-3 text-sm text-stone-700 hover:bg-stone-50"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold uppercase text-white">{user!.name.slice(0, 1)}</span>
        {user!.name}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
          <p className="px-3 py-2 text-xs text-stone-500">Signed in as <span className="font-medium text-stone-700">{user!.username}</span></p>
          <button role="menuitem" className={item} onClick={rename}>Change name</button>
          <button role="menuitem" className={item} onClick={() => (setOpen(false), setChangingPassword(true))}>Change password</button>
          <button role="menuitem" className={item} onClick={() => signOut()}>Sign out</button>
        </div>
      )}
      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
          onChanged={() => {
            setChangingPassword(false);
            toast("Password changed");
          }}
        />
      )}
    </div>
  );
}
