// Firebase/Firestore document types

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_step_goal: number | null;
  daily_calorie_goal: number | null;
  daily_water_goal: number | null;
  weight_goal: number | null;
  created_at: string;
  updated_at: string;
}

export interface FitnessData {
  id: string;
  user_id: string;
  log_date: string;
  steps: number | null;
  water_intake: number | null;
  weight: number | null;
  created_at: string;
  updated_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  workout_name: string;
  workout_type: string;
  duration_minutes: number;
  calories_burned: number;
  notes: string | null;
  workout_date: string;
  created_at: string;
}

export interface CalorieLog {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  meal_type: string;
  log_date: string;
  created_at: string;
}

export interface DashboardStats {
  id: string;
  user_id: string;
  log_date: string;
  steps: number | null;
  water_intake: number | null;
  weight: number | null;
  workout_minutes: number | null;
  calories_burned: number | null;
  calories_consumed: number | null;
  created_at: string;
  updated_at: string;
}
