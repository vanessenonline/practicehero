"use client";

import { useState, useTransition } from "react";
import { BookOpen, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateStudentCourse } from "@/lib/actions/teacher";
import type { Course } from "@/types/database";

interface StudentCourseCardProps {
  studentId: string;
  /** Currently assigned course ID (null if none). */
  initialCourseId: string | null;
  /** Human-readable name of the assigned course (null if none). */
  initialCourseName: string | null;
  /** Current level within the course. */
  initialLevel: number;
  /** Current lesson within the level. */
  initialLesson: number;
  /** Title of the current lesson (null if course has no matching lesson). */
  initialLessonTitle: string | null;
  /** All courses belonging to this teacher's studio (for the dropdown). */
  courses: Course[];
}

/**
 * Client component for assigning/unassigning a course to a student.
 *
 * Shows:
 * - Current course name + position (Level X — Lesson Y) + lesson title
 * - Dropdown to select a different course
 * - "Ontkoppelen" button to remove the course assignment
 *
 * Uses optimistic updates with revert on server error.
 */
export function StudentCourseCard({
  studentId,
  initialCourseId,
  initialCourseName,
  initialLevel,
  initialLesson,
  initialLessonTitle,
  courses,
}: StudentCourseCardProps) {
  const [courseId, setCourseId] = useState<string | null>(initialCourseId);
  const [courseName, setCourseName] = useState<string | null>(initialCourseName);
  const [level, setLevel] = useState(initialLevel);
  const [lesson, setLesson] = useState(initialLesson);
  const [lessonTitle, setLessonTitle] = useState<string | null>(initialLessonTitle);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Assign a new course (or null to unassign). Resets progress optimistically. */
  function handleSelectCourse(newCourseId: string | null) {
    const prevCourseId = courseId;
    const prevCourseName = courseName;
    const prevLevel = level;
    const prevLesson = lesson;
    const prevLessonTitle = lessonTitle;

    // Optimistic update
    setCourseId(newCourseId);
    const selectedCourse = courses.find((c) => c.id === newCourseId) ?? null;
    setCourseName(selectedCourse?.name ?? null);
    setLevel(1);
    setLesson(1);
    // Clear lesson title — it will only be accurate after server re-render
    setLessonTitle(null);
    setShowDropdown(false);
    setError(null);

    startTransition(async () => {
      const result = await updateStudentCourse(studentId, newCourseId);
      if (result.error) {
        // Revert optimistic update
        setCourseId(prevCourseId);
        setCourseName(prevCourseName);
        setLevel(prevLevel);
        setLesson(prevLesson);
        setLessonTitle(prevLessonTitle);
        setError(result.error);
      }
    });
  }

  const activeCourses = courses.filter((c) => c.is_active);

  return (
    <div className="space-y-3">
      {/* Current state */}
      {courseId ? (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{courseName}</p>
              <p className="text-xs text-muted-foreground">
                Niveau {level} — Les {lesson}
                {lessonTitle ? `: ${lessonTitle}` : ""}
              </p>
            </div>
            {/* Unlink button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-muted-foreground hover:text-destructive"
              onClick={() => handleSelectCourse(null)}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Ontkoppelen</span>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Geen cursus gekoppeld. Selecteer een cursus hieronder.
        </p>
      )}

      {/* Course selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown((v) => !v)}
          disabled={isPending || activeCourses.length === 0}
          className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm text-left shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          <span className="text-muted-foreground">
            {activeCourses.length === 0
              ? "Geen cursussen beschikbaar"
              : courseId
              ? "Andere cursus kiezen…"
              : "Cursus selecteren…"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover shadow-md">
            {activeCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => handleSelectCourse(course.id)}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                disabled={course.id === courseId}
              >
                <span className="font-medium">{course.name}</span>
                <span className="text-xs text-muted-foreground">
                  {course.total_levels} niveau{course.total_levels !== 1 ? "s" : ""} •{" "}
                  {course.total_lessons} les{course.total_lessons !== 1 ? "sen" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
