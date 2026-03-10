import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Music, Flame, BookOpen, Calendar } from "lucide-react";
import { getStudents } from "@/lib/actions/teacher";

/**
 * Students list page – displays all students in the teacher's studio.
 * Shows student code, current level/lesson, and links to detail/management pages.
 */
export default async function StudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const students = await getStudents();

  // Map instrument name_key to emoji
  function instIcon(nameKey: string): string {
    const icons: Record<string, string> = {
      piano: "🎹",
      drums: "🥁",
      guitar: "🎸",
      keyboard: "🎹",
      violin: "🎻",
      trumpet: "🎺",
    };
    return icons[nameKey] ?? "🎵";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.teacher.students")}</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} {students.length === 1 ? "leerling" : "leerlingen"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/teacher/students/add`}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("teacher.students.add")}
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {students.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Music className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">{t("teacher.students.empty")}</p>
              <p className="text-sm text-muted-foreground">
                {t("teacher.students.emptyHint")}
              </p>
            </div>
            <Button asChild>
              <Link href={`/${locale}/teacher/students/add`}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {t("teacher.students.add")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Students grid */}
      {students.length > 0 && (
        <div className="space-y-3">
          {students.map((student) => {
            // Format "last practiced" as relative label
            const lastPractice = student.last_practice_date
              ? (() => {
                  const d = new Date(student.last_practice_date);
                  const diffMs = Date.now() - d.getTime();
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays === 0) return "Vandaag";
                  if (diffDays === 1) return "Gisteren";
                  if (diffDays < 7) return `${diffDays} dagen geleden`;
                  return d.toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  });
                })()
              : null;

            return (
              <Link
                key={student.id}
                href={`/${locale}/teacher/students/${student.student_id}`}
                className="block"
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Student info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Name + status row */}
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold truncate">
                            {student.display_name}
                          </h3>
                          {!student.is_active && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactief
                            </Badge>
                          )}
                        </div>

                        {/* Course + lesson progress */}
                        {student.course_name ? (
                          <div className="flex items-start gap-2 text-sm">
                            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                            <div className="min-w-0">
                              <p className="font-medium text-purple-700 truncate">
                                {student.course_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Niveau {student.current_level} — Les{" "}
                                {student.current_lesson}
                                {student.current_lesson_title && (
                                  <span className="text-foreground/70">
                                    : {student.current_lesson_title}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Geen cursus gekoppeld
                          </p>
                        )}

                        {/* Stats row: streak + last practiced */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Flame className="h-3.5 w-3.5 text-orange-500" />
                            <span className="font-medium text-foreground">
                              {student.streak_count}
                            </span>{" "}
                            dag{student.streak_count !== 1 ? "en" : ""}
                          </span>
                          {lastPractice && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {lastPractice}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron hint */}
                      <div className="mt-2 text-muted-foreground">
                        →
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
