import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { ensureUserProfile, getDashboardStats, getDailyFitnessSnapshot, getUserProfile, upsertDailyFitnessSnapshot, upsertDashboardStats } from "@/integrations/firebase/persistence";
import { LogOut, Scale, Bell, Moon, Target, Calculator } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — FitTrack Pro" }, { name: "description", content: "Manage your profile and fitness goals." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["profile", user?.uid], enabled: !!user,
    queryFn: async () => getUserProfile(user!.uid),
  });
  const { data: todayFitness } = useQuery({
    queryKey: ["fitness-today", user?.uid, today], enabled: !!user,
    queryFn: async () => getDailyFitnessSnapshot(user!.uid, today),
  });

  const [form, setForm] = useState({ full_name: "", daily_step_goal: 10000, daily_calorie_goal: 2000, daily_water_goal: 8, weight_goal: "" });
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      daily_step_goal: profile.daily_step_goal ?? 10000,
      daily_calorie_goal: profile.daily_calorie_goal ?? 2000,
      daily_water_goal: profile.daily_water_goal ?? 8,
      weight_goal: profile.weight_goal?.toString() ?? "",
    });
  }, [profile]);
  useEffect(() => { if (todayFitness?.weight) setWeight(String(todayFitness.weight)); }, [todayFitness]);

  async function saveProfile() {
    if (!user) return;
    try {
      await ensureUserProfile(user.uid, {
        full_name: form.full_name,
        daily_step_goal: form.daily_step_goal,
        daily_calorie_goal: form.daily_calorie_goal,
        daily_water_goal: form.daily_water_goal,
        weight_goal: form.weight_goal ? Number(form.weight_goal) : null,
      });
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save profile");
    }
  }

  async function saveWeight() {
    if (!user || !weight) return;
    const numericWeight = Number(weight);
    const saved = await upsertDailyFitnessSnapshot(user.uid, today, { weight: numericWeight });
    const existingStats = await getDashboardStats(user.uid, today);
    await upsertDashboardStats(user.uid, today, {
      steps: existingStats?.steps ?? saved.steps ?? null,
      water_intake: existingStats?.water_intake ?? saved.water_intake ?? null,
      weight: numericWeight,
      workout_minutes: existingStats?.workout_minutes ?? null,
      calories_burned: existingStats?.calories_burned ?? null,
      calories_consumed: existingStats?.calories_consumed ?? null,
    });
    toast.success("Weight logged");
    qc.invalidateQueries({ queryKey: ["fitness-today"] });
    qc.invalidateQueries({ queryKey: ["analytics-fitness"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const bmi = weight && height ? (Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1) : null;
  const name = profile?.full_name ?? user?.email?.split("@")[0] ?? "Athlete";

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[image:var(--gradient-primary)] font-display text-3xl font-bold text-primary-foreground glow-primary">
              {name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold">{name}</h1>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </section>

        {profileLoading && <p className="text-sm text-muted-foreground">Loading your saved profile…</p>}
        {profileError && <p className="text-sm text-destructive">Unable to load your saved profile right now.</p>}

        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Profile & Goals</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Weight Goal (kg)" type="number" value={form.weight_goal} onChange={(v) => setForm({ ...form, weight_goal: v })} />
            <Field label="Daily Step Goal" type="number" value={String(form.daily_step_goal)} onChange={(v) => setForm({ ...form, daily_step_goal: Number(v) })} />
            <Field label="Daily Calorie Goal" type="number" value={String(form.daily_calorie_goal)} onChange={(v) => setForm({ ...form, daily_calorie_goal: Number(v) })} />
            <Field label="Daily Water Goal (cups)" type="number" value={String(form.daily_water_goal)} onChange={(v) => setForm({ ...form, daily_water_goal: Number(v) })} />
          </div>
          <button onClick={saveProfile} className="mt-4 rounded-2xl bg-[image:var(--gradient-primary)] px-6 py-3 font-semibold text-primary-foreground glow-primary transition hover:scale-[1.02]">
            Save Changes
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="glass-card animate-fade-up rounded-3xl p-6">
            <h3 className="font-display text-lg font-bold flex items-center gap-2"><Scale className="h-5 w-5 text-secondary" /> Log Weight</h3>
            <div className="mt-4 flex gap-2">
              <input type="number" step="0.1" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
              <button onClick={saveWeight} className="rounded-2xl glass px-5 font-semibold hover:bg-white/10">Log</button>
            </div>
          </div>

          <div className="glass-card animate-fade-up rounded-3xl p-6">
            <h3 className="font-display text-lg font-bold flex items-center gap-2"><Calculator className="h-5 w-5 text-accent" /> BMI Calculator</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <input type="number" placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
              <input type="number" placeholder="Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
            </div>
            {bmi && (
              <div className="mt-3 rounded-2xl bg-[image:var(--gradient-primary)] p-4 text-center">
                <div className="font-display text-3xl font-bold text-primary-foreground">{bmi}</div>
                <div className="text-xs font-medium text-primary-foreground/80">Your BMI</div>
              </div>
            )}
          </div>
        </section>

        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <h3 className="font-display text-lg font-bold">Settings</h3>
          <div className="mt-4 space-y-2">
            <Toggle icon={Bell} label="Notifications" value={notifications} onChange={setNotifications} />
            <Toggle icon={Moon} label="Dark Mode" value={true} onChange={() => toast.info("FitTrack is dark-first ✨")} />
          </div>
        </section>

        <button onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 font-semibold text-destructive transition hover:bg-destructive/20">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/50" />
    </div>
  );
}

function Toggle({ icon: Icon, label, value, onChange }: { icon: React.ComponentType<any>; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 transition hover:bg-white/10">
      <span className="flex items-center gap-3 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
