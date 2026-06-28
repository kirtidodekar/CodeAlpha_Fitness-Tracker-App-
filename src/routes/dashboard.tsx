import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProgressRing } from "@/components/ProgressRing";
import { useAuth } from "@/hooks/use-auth";
import { getDashboardStats, getDailyFitnessSnapshot, getUserProfile, listUserCalorieLogs, listUserWorkouts } from "@/integrations/firebase/persistence";
import { Footprints, Flame, Timer, Droplets, Dumbbell, UtensilsCrossed, Plus, Scale, Quote } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { format, subDays, startOfWeek, addDays } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FitTrack Pro" }, { name: "description", content: "Your daily fitness overview." }] }),
  component: Dashboard,
});

const quotes = [
  "The body achieves what the mind believes.",
  "Sweat is just fat crying.",
  "Don't limit your challenges. Challenge your limits.",
  "Strength does not come from the body. It comes from the will.",
  "Success starts with self-discipline.",
];

function Dashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["profile", user?.uid],
    enabled: !!user,
    queryFn: async () => getUserProfile(user!.uid),
  });

  const { data: todayData, isLoading: todayLoading, error: todayError } = useQuery({
    queryKey: ["fitness-today", user?.uid, today],
    enabled: !!user,
    queryFn: async () => getDailyFitnessSnapshot(user!.uid, today),
  });

  const { data: todayWorkouts, isLoading: workoutsLoading, error: workoutsError } = useQuery({
    queryKey: ["workouts-today", user?.uid, today],
    enabled: !!user,
    queryFn: async () => {
      const workouts = await listUserWorkouts(user!.uid);
      return workouts.filter((w) => w.workout_date === today);
    },
  });

  const { data: todayCalories, isLoading: calsLoading, error: calsError } = useQuery({
    queryKey: ["cal-today", user?.uid, today],
    enabled: !!user,
    queryFn: async () => {
      const logs = await listUserCalorieLogs(user!.uid);
      return logs.filter((c) => c.log_date === today);
    },
  });

  const { data: persistedStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["dashboard-stats", user?.uid, today],
    enabled: !!user,
    queryFn: async () => getDashboardStats(user!.uid, today),
  });

  const { data: weekly } = useQuery({
    queryKey: ["week-workouts", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      const workouts = await listUserWorkouts(user!.uid);
      const start = format(subDays(new Date(), 6), "yyyy-MM-dd");
      return workouts.filter((w) => w.workout_date >= start);
    },
  });

  const steps = todayData?.steps ?? persistedStats?.steps ?? 0;
  const water = todayData?.water_intake ?? persistedStats?.water_intake ?? 0;
  const workoutMins = persistedStats?.workout_minutes ?? (todayWorkouts ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
  const caloriesBurned = persistedStats?.calories_burned ?? (todayWorkouts ?? []).reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const caloriesEaten = persistedStats?.calories_consumed ?? (todayCalories ?? []).reduce((s, c) => s + (c.calories ?? 0), 0);

  const stepGoal = profile?.daily_step_goal ?? 10000;
  const waterGoal = profile?.daily_water_goal ?? 8;
  const calGoal = profile?.daily_calorie_goal ?? 2000;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const ds = format(d, "yyyy-MM-dd");
    const total = (weekly ?? []).filter((w) => w.workout_date === ds).reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
    return { day: format(d, "EEE"), mins: total };
  });

  const name = (profile?.full_name ?? user?.email?.split("@")[0]) ?? "Athlete";
  const initial = name[0]?.toUpperCase() ?? "F";
  const quote = quotes[new Date().getDate() % quotes.length];

  const stats = [
    { icon: Footprints, label: "Steps", value: steps.toLocaleString(), goal: stepGoal, color: "var(--color-primary)" },
    { icon: Flame, label: "Calories Burned", value: caloriesBurned, goal: 500, color: "var(--color-accent)" },
    { icon: Timer, label: "Workout Min", value: workoutMins, goal: 60, color: "var(--color-secondary)" },
    { icon: Droplets, label: "Water (cups)", value: water, goal: waterGoal, color: "var(--color-secondary)" },
  ];

  const actions = [
    { to: "/workouts", icon: Dumbbell, label: "Add Workout", color: "from-primary/30 to-primary/5" },
    { to: "/calories", icon: UtensilsCrossed, label: "Log Calories", color: "from-accent/30 to-accent/5" },
    { to: "/steps", icon: Footprints, label: "Track Steps", color: "from-secondary/30 to-secondary/5" },
    { to: "/profile", icon: Scale, label: "Track Weight", color: "from-primary/30 to-secondary/10" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-6">
        {(profileLoading || todayLoading || workoutsLoading || calsLoading || statsLoading) && <p className="text-sm text-muted-foreground">Loading your saved fitness data…</p>}
        {(profileError || todayError || workoutsError || calsError || statsError) && <p className="text-sm text-destructive">Some saved data could not be restored right now.</p>}

        <section className="animate-fade-up grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
            <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">Welcome back, <span className="gradient-text">{name}</span></h1>
          </div>
          <Link to="/profile" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] font-bold text-primary-foreground glow-primary">
            {initial}
          </Link>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label}
              className="glass-card animate-fade-up rounded-3xl p-4 transition hover:-translate-y-1"
              style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5" style={{ color: s.color }}>
                  <s.icon className="h-5 w-5" />
                </div>
                <ProgressRing value={Number(s.value.toString().replace(/,/g, ""))} max={s.goal} size={48} stroke={5} color={s.color} />
              </div>
              <div className="mt-3 font-display text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label} / {s.goal.toLocaleString()}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="glass-card animate-fade-up rounded-3xl p-6 md:col-span-2">
            <h3 className="font-display text-lg font-bold">Today's Goals</h3>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col items-center">
                <ProgressRing value={steps} max={stepGoal} size={110} stroke={10} color="var(--color-primary)"
                  label={`${Math.round((steps / stepGoal) * 100)}%`} sub="Steps" />
              </div>
              <div className="flex flex-col items-center">
                <ProgressRing value={caloriesEaten} max={calGoal} size={110} stroke={10} color="var(--color-accent)"
                  label={`${Math.round((caloriesEaten / calGoal) * 100)}%`} sub="Calories" />
              </div>
              <div className="flex flex-col items-center">
                <ProgressRing value={water} max={waterGoal} size={110} stroke={10} color="var(--color-secondary)"
                  label={`${water}/${waterGoal}`} sub="Water" />
              </div>
            </div>
          </div>

          <div className="glass-card animate-fade-up rounded-3xl p-6">
            <Quote className="h-5 w-5 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold leading-snug">"{quote}"</p>
            <p className="mt-3 text-xs text-muted-foreground">Daily motivation</p>
          </div>
        </section>

        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Weekly Activity</h3>
            <span className="text-xs text-muted-foreground">Workout minutes</span>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" stroke="oklch(0.75 0.02 250)" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
                  contentStyle={{ background: "oklch(0.24 0.04 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="mins" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, i) => (<Cell key={i} fill={i === new Date().getDay() - 1 ? "var(--color-primary)" : "oklch(0.72 0.18 235 / 0.6)"} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-display text-lg font-bold">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {actions.map((a, i) => (
              <Link key={a.to} to={a.to}
                className={`group glass-card animate-fade-up rounded-3xl bg-gradient-to-br ${a.color} p-4 transition hover:-translate-y-1`}
                style={{ animationDelay: `${i * 0.05}s` }}>
                <a.icon className="h-6 w-6 text-foreground transition-transform group-hover:scale-110" />
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm font-semibold">{a.label}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
