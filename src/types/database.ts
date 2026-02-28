export type UserRole = "parent" | "child" | "teacher";
export type SessionStatus = "active" | "completed" | "abandoned";
export type StreakStatus = "active" | "recovery" | "broken";
export type PointSource =
  | "bonus_time"
  | "streak_milestone"
  | "achievement"
  | "spent";

export interface Family {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type Theme = "light" | "dark" | "system";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Profile {
  id: string;
  family_id: string | null;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  auth_email: string | null;
  locale: "nl" | "en";
  can_send_messages: boolean;
  theme: Theme;
  daily_goal_minutes: number;
  practice_days: DayOfWeek[];
  notifications_enabled: boolean;
  notification_streak_reminder: boolean;
  notification_achievement: boolean;
  created_at: string;
  updated_at: string;
}

export interface Instrument {
  id: string;
  name_key: string;
  icon: string;
  detection_profile: "pitched" | "percussive";
  created_at: string;
}

export interface ChildInstrument {
  id: string;
  child_id: string;
  instrument_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface PracticeSession {
  id: string;
  child_id: string;
  instrument_id: string;
  family_id: string | null;
  studio_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: SessionStatus;
  audio_verified: boolean;
  audio_confidence: number | null;
  notes: string | null;
  created_at: string;
}

export interface Streak {
  id: string;
  child_id: string;
  family_id: string | null;
  current_count: number;
  longest_count: number;
  status: StreakStatus;
  last_practice_date: string | null;
  frozen_count: number;
  recovery_sessions_needed: number;
  missed_days: number;
  grace_dates: string[];
  created_at: string;
  updated_at: string;
}

export interface PointEntry {
  id: string;
  child_id: string;
  family_id: string | null;
  amount: number;
  source: PointSource;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface SuperCredit {
  id: string;
  child_id: string;
  family_id: string | null;
  amount: number;
  source: string;
  reference_id: string | null;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name_key: string;
  description_key: string;
  cost_credits: number;
  item_type: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  child_id: string;
  shop_item_id: string;
  family_id: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

export interface PracticeContent {
  id: string;
  child_id: string;
  instrument_id: string;
  family_id: string;
  content_type: "lesson" | "motivator";
  title: string;
  description: string | null;
  week_number: number | null;
  is_active: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  video_url: string | null;
  audio_url: string | null;
  is_repeat: boolean;
  source_content_id: string | null;
  bonus_points: number;
  created_at: string;
  updated_at: string;
}

export interface Motivator {
  id: string;
  instrument_id: string;
  title: string;
  description: string | null;
  difficulty_level: number;
  media_url: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  family_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  name_key: string;
  description_key: string;
  icon: string;
  category: string;
  threshold: number | null;
  created_at: string;
}

export interface ChildAchievement {
  id: string;
  child_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface Studio {
  id: string;
  owner_id: string;
  name: string;
  teacher_code: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  studio_id: string;
  instrument_id: string;
  name: string;
  description: string | null;
  total_lessons: number;
  total_levels: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  lesson_number: number;
  level_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  audio_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeacherStudent {
  id: string;
  studio_id: string;
  student_id: string;
  course_id: string | null;
  student_code: string;
  current_level: number;
  current_lesson: number;
  start_date: string;
  target_end_date: string | null;
  student_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
