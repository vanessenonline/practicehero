import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Music, BookOpen } from "lucide-react";
import { getCourses } from "@/lib/actions/teacher";

/**
 * Courses list page – displays all courses in the teacher's studio.
 * Shows course name, instrument, total lessons/levels, and links to edit.
 */
export default async function CoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const courses = await getCourses();

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
          <h1 className="text-2xl font-bold">{t("nav.teacher.courses")}</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length} {courses.length === 1 ? "cursus" : "cursussen"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/teacher/courses/add`}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("teacher.courses.add")}
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {courses.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">{t("teacher.courses.empty")}</p>
              <p className="text-sm text-muted-foreground">
                {t("teacher.courses.emptyHint")}
              </p>
            </div>
            <Button asChild>
              <Link href={`/${locale}/teacher/courses/add`}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("teacher.courses.add")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Courses grid */}
      {courses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-2xl">
                        {instIcon(course.instrument_id)}
                      </span>
                      <span className="truncate">{course.name}</span>
                    </CardTitle>
                  </div>
                  {course.is_active ? (
                    <Badge variant="default" className="bg-green-500 whitespace-nowrap">
                      Actief
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">
                      Inactief
                    </Badge>
                  )}
                </div>
                {course.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {course.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground">Lessen</p>
                    <p className="font-bold text-lg">{course.total_lessons}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground">Niveaus</p>
                    <p className="font-bold text-lg">{course.total_levels}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/${locale}/teacher/courses/${course.id}`}>
                      Details
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/${locale}/teacher/courses/${course.id}/lessons`}>
                      Lessen
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
