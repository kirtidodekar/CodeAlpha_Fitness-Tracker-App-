import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type { CalorieLog, DashboardStats, FitnessData, Profile, Workout } from "./types";

function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

async function findDocByUserAndDate(collectionName: string, userId: string, logDate: string) {
  const q = query(collection(db, collectionName), where("user_id", "==", userId), where("log_date", "==", logDate));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

export async function ensureUserProfile(userId: string, profile?: Partial<Profile>): Promise<Profile | null> {
  const ref = doc(db, "profiles", userId);
  const existing = await getDoc(ref);
  const payload = cleanPayload({
    id: userId,
    ...profile,
    updated_at: serverTimestamp(),
    ...(existing.exists() ? {} : { created_at: serverTimestamp() }),
  });

  if (existing.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload, { merge: true });
  }

  const saved = await getDoc(ref);
  return saved.exists() ? ({ id: saved.id, ...(saved.data() as Profile) } as Profile) : null;
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const ref = doc(db, "profiles", userId);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? ({ id: snapshot.id, ...(snapshot.data() as Profile) } as Profile) : null;
}

export async function getDailyFitnessSnapshot(userId: string, logDate: string): Promise<FitnessData | null> {
  const existing = await findDocByUserAndDate("fitness_data", userId, logDate);
  if (!existing) return null;
  return { id: existing.id, ...(existing.data as FitnessData) } as FitnessData;
}

export async function upsertDailyFitnessSnapshot(userId: string, logDate: string, data: Partial<FitnessData>): Promise<FitnessData> {
  const existing = await findDocByUserAndDate("fitness_data", userId, logDate);
  const ref = existing ? doc(db, "fitness_data", existing.id) : doc(collection(db, "fitness_data"));
  const payload = cleanPayload({
    id: ref.id,
    user_id: userId,
    log_date: logDate,
    ...data,
    updated_at: serverTimestamp(),
    ...(existing ? {} : { created_at: serverTimestamp() }),
  });

  if (existing) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }

  const saved = await getDoc(ref);
  return { id: saved.id, ...(saved.data() as FitnessData) } as FitnessData;
}

export async function listUserWorkouts(userId: string): Promise<Workout[]> {
  const q = query(collection(db, "workouts"), where("user_id", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Workout))
    .sort((a, b) => {
      const dateDiff = (b.workout_date ?? "").localeCompare(a.workout_date ?? "");
      if (dateDiff !== 0) return dateDiff;
      return (b.created_at ?? "").toString().localeCompare((a.created_at ?? "").toString());
    });
}

export async function saveWorkout(userId: string, workout: Omit<Workout, "id" | "user_id" | "created_at">): Promise<Workout> {
  const ref = doc(collection(db, "workouts"));
  const payload = cleanPayload({
    id: ref.id,
    user_id: userId,
    ...workout,
    created_at: serverTimestamp(),
  });
  await setDoc(ref, payload);
  const saved = await getDoc(ref);
  return { id: saved.id, ...(saved.data() as Workout) } as Workout;
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await deleteDoc(doc(db, "workouts", workoutId));
}

export async function listUserCalorieLogs(userId: string): Promise<CalorieLog[]> {
  const q = query(collection(db, "calorie_logs"), where("user_id", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CalorieLog))
    .sort((a, b) => {
      const dateDiff = (a.log_date ?? "").localeCompare(b.log_date ?? "");
      if (dateDiff !== 0) return dateDiff;
      return (a.created_at ?? "").toString().localeCompare((b.created_at ?? "").toString());
    });
}

export async function saveCalorieLog(userId: string, log: Omit<CalorieLog, "id" | "user_id" | "created_at">): Promise<CalorieLog> {
  const ref = doc(collection(db, "calorie_logs"));
  const payload = cleanPayload({
    id: ref.id,
    user_id: userId,
    ...log,
    created_at: serverTimestamp(),
  });
  await setDoc(ref, payload);
  const saved = await getDoc(ref);
  return { id: saved.id, ...(saved.data() as CalorieLog) } as CalorieLog;
}

export async function deleteCalorieLog(logId: string): Promise<void> {
  await deleteDoc(doc(db, "calorie_logs", logId));
}

export async function upsertDashboardStats(userId: string, logDate: string, data: Partial<DashboardStats>): Promise<DashboardStats> {
  const existing = await findDocByUserAndDate("dashboard_stats", userId, logDate);
  const ref = existing ? doc(db, "dashboard_stats", existing.id) : doc(collection(db, "dashboard_stats"));
  const payload = cleanPayload({
    id: ref.id,
    user_id: userId,
    log_date: logDate,
    ...data,
    updated_at: serverTimestamp(),
    ...(existing ? {} : { created_at: serverTimestamp() }),
  });

  if (existing) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }

  const saved = await getDoc(ref);
  return { id: saved.id, ...(saved.data() as DashboardStats) } as DashboardStats;
}

export async function getDashboardStats(userId: string, logDate: string): Promise<DashboardStats | null> {
  const existing = await findDocByUserAndDate("dashboard_stats", userId, logDate);
  if (!existing) return null;
  return { id: existing.id, ...(existing.data as DashboardStats) } as DashboardStats;
}

export async function listDashboardStats(userId: string, startDate?: string): Promise<DashboardStats[]> {
  const q = query(collection(db, "dashboard_stats"), where("user_id", "==", userId));
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as DashboardStats));
  return rows
    .filter((row) => !startDate || (row.log_date ?? "") >= startDate)
    .sort((a, b) => (a.log_date ?? "").localeCompare(b.log_date ?? ""));
}

export async function listFitnessHistory(userId: string, startDate?: string): Promise<FitnessData[]> {
  const q = query(collection(db, "fitness_data"), where("user_id", "==", userId));
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FitnessData));
  return rows
    .filter((row) => !startDate || (row.log_date ?? "") >= startDate)
    .sort((a, b) => (a.log_date ?? "").localeCompare(b.log_date ?? ""));
}
