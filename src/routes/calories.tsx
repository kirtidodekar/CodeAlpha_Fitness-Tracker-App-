import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { deleteCalorieLog, getDashboardStats, getUserProfile, listUserCalorieLogs, saveCalorieLog, upsertDashboardStats } from "@/integrations/firebase/persistence";
import { UtensilsCrossed, Coffee, Sun, Moon, Cookie, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Meal = "breakfast" | "lunch" | "dinner" | "snacks";

export const Route = createFileRoute("/calories")({
  head: () => ({ meta: [{ title: "Calories — FitTrack Pro" }, { name: "description", content: "Track your daily calorie intake." }] }),
  component: CaloriesPage,
});

const MEALS: { id: Meal; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { id: "breakfast", label: "Breakfast", icon: Coffee, color: "text-accent" },
  { id: "lunch", label: "Lunch", icon: Sun, color: "text-primary" },
  { id: "dinner", label: "Dinner", icon: Moon, color: "text-secondary" },
  { id: "snacks", label: "Snacks", icon: Cookie, color: "text-accent" },
];

function CaloriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState<{ food_name: string; calories: string; meal_type: Meal }>({ food_name: "", calories: "", meal_type: "breakfast" });
  const [saving, setSaving] = useState(false);

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["calorie_logs", user?.uid, today],
    enabled: !!user,
    queryFn: async () => (await listUserCalorieLogs(user!.uid)).filter((log) => log.log_date === today),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid], enabled: !!user,
    queryFn: async () => getUserProfile(user!.uid),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const calories = Number(form.calories);
      await saveCalorieLog(user.uid, {
        food_name: form.food_name,
        calories,
        meal_type: form.meal_type,
        log_date: today,
      });

      const existingStats = await getDashboardStats(user.uid, today);
      await upsertDashboardStats(user.uid, today, {
        steps: existingStats?.steps ?? null,
        water_intake: existingStats?.water_intake ?? null,
        weight: existingStats?.weight ?? null,
        workout_minutes: existingStats?.workout_minutes ?? null,
        calories_burned: existingStats?.calories_burned ?? null,
        calories_consumed: (existingStats?.calories_consumed ?? 0) + calories,
      });

      toast.success("Added");
      setForm({ ...form, food_name: "", calories: "" });
      qc.invalidateQueries({ queryKey: ["calorie_logs"] });
      qc.invalidateQueries({ queryKey: ["cal-today"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add calorie log");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCalorieLog(id);
      qc.invalidateQueries({ queryKey: ["calorie_logs"] });
      qc.invalidateQueries({ queryKey: ["cal-today"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete calorie log");
    }
  }

  const total = (logs ?? []).reduce((s, l) => s + l.calories, 0);
  const goal = profile?.daily_calorie_goal ?? 2000;
  const pct = Math.min(100, Math.round((total / goal) * 100));

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold">Calorie Tracker</h1>
              <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-3xl font-bold gradient-text">{total}</div>
              <div className="text-xs text-muted-foreground">of {goal} kcal</div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-[image:var(--gradient-accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </section>

        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><UtensilsCrossed className="h-5 w-5 text-primary" /> Add Food</h3>
          <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input required placeholder="Food name" value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
            <input required type="number" placeholder="Calories" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
            <select value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value as Meal })}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50">
              {MEALS.map((m) => <option key={m.id} value={m.id} className="bg-card">{m.label}</option>)}
            </select>
            <button disabled={saving} className="rounded-2xl bg-[image:var(--gradient-primary)] px-6 py-3 font-semibold text-primary-foreground glow-primary transition hover:scale-[1.02]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </button>
          </form>
        </section>

        {isLoading && <p className="text-sm text-muted-foreground">Loading your calorie history…</p>}
        {error && <p className="text-sm text-destructive">Unable to load calorie history right now.</p>}

        <section className="grid gap-4 md:grid-cols-2">
          {MEALS.map((m, i) => {
            const items = (logs ?? []).filter((l) => l.meal_type === m.id);
            const sum = items.reduce((s, l) => s + l.calories, 0);
            return (
              <div key={m.id} className="glass-card animate-fade-up rounded-3xl p-5" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <m.icon className={`h-5 w-5 ${m.color}`} />
                    <h4 className="font-display font-bold">{m.label}</h4>
                  </div>
                  <span className="text-sm font-semibold">{sum} kcal</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {items.length === 0 && <p className="text-xs text-muted-foreground">No items logged</p>}
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                      <span className="truncate">{it.food_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{it.calories} kcal</span>
                        <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
