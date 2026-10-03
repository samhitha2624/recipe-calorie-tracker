import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import AuthPage from "./pages/AuthPage";
import RecipesPage from "./pages/RecipesPage";
import RecipePage from "./pages/RecipePage";
import RecipeEditor from "./pages/RecipeEditor";
import TrackerPage from "./pages/TrackerPage";

export default function App() {
  const { user, loading, setUser } = useAuth();
  if (loading) return <p className="p-8 text-stone-500">Loading…</p>;
  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-100 text-emerald-900" : "text-stone-600 hover:bg-stone-100"}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-semibold text-emerald-800">Recipe Calories</span>
          <nav className="flex gap-1">
            <NavLink to="/recipes" className={link}>Recipes</NavLink>
            <NavLink to="/tracker" className={link}>My day</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-stone-600">
            <span>{user.name}</span>
            <button
              className="btn-secondary px-3 py-1"
              onClick={async () => {
                await api("/auth/logout", { method: "POST" });
                setUser(null);
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeEditor />} />
          <Route path="/recipes/:id" element={<RecipePage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="*" element={<Navigate to="/recipes" replace />} />
        </Routes>
      </main>
    </div>
  );
}
