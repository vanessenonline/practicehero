/**
 * Normalised lesson content type accepted by PracticeSession.
 *
 * Both parent-created practice_content rows and teacher course_lessons are
 * adapted to this shape so the practice UI can render either source without
 * knowing where the data came from.
 */
export interface LessonContent {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  audio_url: string | null;
  /** Only present for practice_content rows. */
  is_repeat?: boolean;
  /** Only present for practice_content rows. */
  bonus_points?: number;
  /** Course lesson number within its level (only for course_lesson source). */
  lesson_number?: number;
  /** Course level number (only for course_lesson source). */
  level_number?: number;
  /** Where this content came from — used for UI hints and analytics. */
  source: "practice_content" | "course_lesson";
}
