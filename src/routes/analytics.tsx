import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { listFitnessHistory, listUserCalorieLogs, listUserWorkouts } from "@/integrations/firebase/persistence";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — FitTrack Pro" }, { name: "description", content: "Your fitness progress over time." }] }),
  component: AnalyticsPage,
});

const tipsList = [
  "Drink water before, during, and after workouts.",
  "Sleep 7-9 hours for optimal recovery.",
  "Mix cardio with strength for balanced fitness.",
  "Track macros, not just calories.",
  "Rest days are when muscles grow.",
];

function AnalyticsPage() {
  const { user } = useAuth();
  const start = format(subDays(new Date(), 29), "yyyy-MM-dd");

  const { data: workouts, isLoading: workoutsLoading, error: workoutsError } = useQuery({
    queryKey: ["analytics-workouts", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      const rows = await listUserWorkouts(user!.uid);
      return rows.filter((w) => w.workout_date >= start);
    },
  });

  const { data: cals, isLoading: calsLoading, error: calsError } = useQuery({
    queryKey: ["analytics-cals", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      const rows = await listUserCalorieLogs(user!.uid);
      return rows.filter((c) => c.log_date >= start);
    },
  });

  const { data: fitness, isLoading: fitnessLoading, error: fitnessError } = useQuery({
    queryKey: ["analytics-fitness", user?.uid],
    enabled: !!user,
    queryFn: async () => listFitnessHistory(user!.uid, start),
  });

  const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
  const weeklyCals = days.map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const total = (cals ?? []).filter((c) => c.log_date === ds).reduce((s, c) => s + (c.calories ?? 0), 0);
    return { day: format(d, "EEE"), cal: total };
  });
  const monthlyWorkouts = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }).map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const total = (workouts ?? []).filter((w) => w.workout_date === ds).reduce((s, w) => s + w.duration_minutes, 0);
    return { day: format(d, "d"), mins: total };
  });
  const weightData = (fitness ?? []).filter((f) => f.weight != null).map((f) => ({ day: format(new Date(f.log_date), "MMM d"), weight: Number(f.weight) }));

  const totalWorkouts = workouts?.length ?? 0;
  const totalMinutes = (workouts ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
  const totalCalsBurned = (workouts ?? []).reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const streak = computeStreak(fitness ?? [], workouts ?? []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="animate-fade-up">
          <h1 className="font-display text-3xl font-bold">Progress <span className="gradient-text">Analytics</span></h1>
          <p className="text-sm text-muted-foreground">Last 30 days of activity</p>
        </header>

        {(workoutsLoading || calsLoading || fitnessLoading) && <p className="text-sm text-muted-foreground">Restoring your progress history…</p>}
        {(workoutsError || calsError || fitnessError) && <p className="text-sm text-destructive">Unable to restore all analytics data right now.</p>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Workouts" value={totalWorkouts} />
          <Stat label="Minutes" value={totalMinutes} />
          <Stat label="Calories Burned" value={totalCalsBurned} />
          <Stat label="Day Streak" value={streak} accent />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Chart title="Weekly Calories Intake">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyCals}>
                <defs>
                  <linearGradient id="ac" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="oklch(0.75 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.75 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="cal" stroke="var(--color-accent)" strokeWidth={2} fill="url(#ac)" />
              </AreaChart>
            </ResponsiveContainer>
          </Chart>

          <Chart title="Monthly Workout Minutes">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyWorkouts}>
                <XAxis dataKey="day" stroke="oklch(0.75 0.02 250)" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="oklch(0.75 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(1 0 0 / 0.05)" }} />
                <Bar dataKey="mins" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Chart>

          <Chart title="Weight Progress" full>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightData}>
                <XAxis dataKey="day" stroke="oklch(0.75 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.75 0.02 250)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" stroke="var(--color-secondary)" strokeWidth={3} dot={{ fill: "var(--color-secondary)" }} />
              </LineChart>
            </ResponsiveContainer>
            {weightData.length === 0 && <p className="mt-2 text-center text-xs text-muted-foreground">Log your weight on the Profile page to see progress</p>}
          </Chart>
        </section>

        <section className="glass-card animate-fade-up rounded-3xl p-6">
          <h3 className="font-display text-lg font-bold">Fitness Tips</h3>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {tipsList.map((t, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

const tooltipStyle = { background: "oklch(0.24 0.04 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 };

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass-card animate-fade-up rounded-3xl p-5">
      <div className={`font-display text-3xl font-bold ${accent ? "gradient-text" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Chart({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`glass-card animate-fade-up rounded-3xl p-5 ${full ? "lg:col-span-2" : ""}`}>
      <h3 className="mb-3 font-display font-bold">{title}</h3>
      {children}
    </div>
  );
}

function computeStreak(fitness: any[], workouts: any[]): number {
  const active = new Set<string>();
  fitness.forEach((f) => { if ((f.steps ?? 0) > 0 || (f.water_intake ?? 0) > 0) active.add(f.log_date); });
  workouts.forEach((w) => active.add(w.workout_date));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (active.has(d)) streak++; else if (i > 0) break;
  }
  return streak;
}
