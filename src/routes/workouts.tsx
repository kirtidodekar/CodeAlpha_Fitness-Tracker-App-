import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { deleteWorkout, getDashboardStats, listUserWorkouts, saveWorkout, upsertDashboardStats } from "@/integrations/firebase/persistence";
import { Dumbbell, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/workouts")({
  head: () => ({ meta: [{ title: "Workouts — FitTrack Pro" }, { name: "description", content: "Log and track your workouts." }] }),
  component: WorkoutsPage,
});

const TYPES = ["Cardio", "Strength", "HIIT", "Yoga", "Cycling", "Running", "Swimming", "Other"];

function WorkoutsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({ workout_name: "", workout_type: "Cardio", duration_minutes: "", calories_burned: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: workouts, isLoading, error } = useQuery({
    queryKey: ["workouts", user?.uid],
    enabled: !!user,
    queryFn: async () => listUserWorkouts(user!.uid),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const duration = Number(form.duration_minutes);
      const calories = Number(form.calories_burned || 0);
      await saveWorkout(user.uid, {
        workout_name: form.workout_name,
        workout_type: form.workout_type,
        duration_minutes: duration,
        calories_burned: calories,
        notes: form.notes || null,
        workout_date: today,
      });

      const existingStats = await getDashboardStats(user.uid, today);
      await upsertDashboardStats(user.uid, today, {
        steps: existingStats?.steps ?? null,
        water_intake: existingStats?.water_intake ?? null,
        weight: existingStats?.weight ?? null,
        workout_minutes: (existingStats?.workout_minutes ?? 0) + duration,
        calories_burned: (existingStats?.calories_burned ?? 0) + calories,
        calories_consumed: existingStats?.calories_consumed ?? null,
      });

      toast.success("Workout saved! 💪");
      setForm({ workout_name: "", workout_type: "Cardio", duration_minutes: "", calories_burned: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["workouts-today"] });
      qc.invalidateQueries({ queryKey: ["week-workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteWorkout(id);
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete workout");
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)]"><Dumbbell className="h-5 w-5 text-primary-foreground" /></div>
            <div>
              <h2 className="font-display text-xl font-bold">Add Workout</h2>
              <p className="text-xs text-muted-foreground">Log a new session</p>
            </div>
          </div>
          <form onSubmit={save} className="mt-5 space-y-3">
            <Input label="Workout Name" value={form.workout_name} onChange={(v) => setForm({ ...form, workout_name: v })} required placeholder="Morning Run" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
              <select value={form.workout_type} onChange={(e) => setForm({ ...form, workout_type: e.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50">
                {TYPES.map((t) => <option key={t} value={t} className="bg-card">{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Duration (min)" type="number" value={form.duration_minutes} onChange={(v) => setForm({ ...form, duration_minutes: v })} required />
              <Input label="Calories burned" type="number" value={form.calories_burned} onChange={(v) => setForm({ ...form, calories_burned: v })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
            </div>
            <button type="submit" disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[image:var(--gradient-primary)] py-3 font-semibold text-primary-foreground glow-primary transition hover:scale-[1.02]">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Workout
            </button>
          </form>
        </section>

        <section>
          <h3 className="mb-3 font-display text-lg font-bold">History</h3>
          {isLoading && <p className="mb-3 text-sm text-muted-foreground">Loading saved workouts…</p>}
          {error && <p className="mb-3 text-sm text-destructive">Unable to load workout history right now.</p>}
          <div className="space-y-3">
            {!isLoading && !error && workouts?.length === 0 && <p className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No workouts yet — log your first session!</p>}
            {workouts?.map((w, i) => (
              <div key={w.id}
                className="glass-card animate-fade-up flex items-center justify-between gap-3 rounded-2xl p-4"
                style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{w.workout_name}</span>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">{w.workout_type}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(w.workout_date), "MMM d")} · {w.duration_minutes} min · {w.calories_burned} kcal
                  </div>
                  {w.notes && <div className="mt-1 truncate text-xs text-muted-foreground">{w.notes}</div>}
                </div>
                <button onClick={() => remove(w.id)} className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Input({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
    </div>
  );
}
