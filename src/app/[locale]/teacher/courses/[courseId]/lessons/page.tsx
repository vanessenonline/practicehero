import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
import { getCourseDetail } from "@/lib/actions/teacher";
import { DeleteLessonButton } from "./DeleteLessonButton";

/**
 * Lessons management page – add, edit, and delete lessons for a course.
 * Shows lessons grid with options to modify each lesson.
 */
export default async function LessonsPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  const t = await getTranslations();

  const { course, error } = await getCourseDetail(courseId);

  if (error || !course) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/courses`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error || "Cursus niet gevonden"}
        </div>
      </div>
    );
  }

  // Create lesson matrix
  const lessonMatrix: Record<number, Record<number, any>> = {};
  for (let level = 1; level <= course.total_levels; level++) {
    lessonMatrix[level] = {};
    for (let lesson = 1; lesson <= course.total_lessons; lesson++) {
      lessonMatrix[level][lesson] = null;
    }
  }

  // Fill matrix with existing lessons
  course.lessons.forEach((lesson) => {
    lessonMatrix[lesson.level_number][lesson.lesson_number] = lesson;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back navigation */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/teacher/courses/${courseId}`}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lessen beheren</h1>
          <p className="text-sm text-muted-foreground">
            {course.name} – {course.total_lessons} lessen × {course.total_levels} niveaus
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/teacher/courses/${courseId}/lessons/add`}>
            <Plus className="mr-1.5 h-4 w-4" />
            Les toevoegen
          </Link>
        </Button>
      </div>

      {/* Lessons matrix (scrollable on mobile) */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 text-left font-semibold">Niveau</th>
              {Array.from({ length: Math.min(course.total_lessons, 10) }, (_, i) => (
                <th key={i} className="p-3 text-center font-semibold text-xs">
                  L{i + 1}
                </th>
              ))}
              {course.total_lessons > 10 && (
                <th className="p-3 text-center font-semibold text-xs text-muted-foreground">
                  +{course.total_lessons - 10}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: course.total_levels }, (_, level) => (
              <tr key={level} className="border-b hover:bg-muted/50">
                <td className="border-r p-3 font-semibold">
                  Niveau {level + 1}
                </td>
                {Array.from(
                  { length: Math.min(course.total_lessons, 10) },
                  (_, lesson) => {
                    const lesson_number = lesson + 1;
                    const level_number = level + 1;
                    const lessonData = lessonMatrix[level_number]?.[lesson_number];

                    return (
                      <td
                        key={`${level}-${lesson}`}
                        className="p-2 text-center hover:bg-muted"
                      >
                        {lessonData ? (
                          <div className="space-y-2">
                            <div className="rounded bg-green-50 p-2 text-xs">
                              <p className="font-semibold text-green-900">
                                {lessonData.title || "Les"}
                              </p>
                              <p className="text-green-700">
                                #{lessonData.sort_order}
                              </p>
                            </div>
                            <div className="flex justify-center gap-1">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Link
                                  href={`/${locale}/teacher/courses/${courseId}/lessons/${lessonData.id}/edit`}
                                >
                                  ✎
                                </Link>
                              </Button>
                              <DeleteLessonButton
                                lessonId={lessonData.id}
                                lessonTitle={lessonData.title || "Les"}
                              />
                            </div>
                          </div>
                        ) : (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 w-full text-xs"
                          >
                            <Link
                              href={`/${locale}/teacher/courses/${courseId}/lessons/add?level=${level_number}&lesson=${lesson_number}`}
                            >
                              +
                            </Link>
                          </Button>
                        )}
                      </td>
                    );
                  }
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Helper text */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">💡 Tips:</p>
        <ul className="list-inside space-y-1">
          <li>Klik + om een les toe te voegen aan een positie</li>
          <li>Klik ✎ om een les te bewerken</li>
          <li>Klik 🗑 om een les te verwijderen</li>
          <li>Je kunt tot {course.total_lessons} lessen per niveau hebben</li>
        </ul>
      </div>
    </div>
  );
}
