import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit, Trash2 } from "lucide-react";
import { getCourseDetail } from "@/lib/actions/teacher";

/**
 * Course detail page – shows course information and lesson grid.
 * Displays lessons organized by level and lesson number.
 */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  const t = await getTranslations();

  const { course, error } = await getCourseDetail(courseId);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/courses`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}: {error}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/courses`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
        <Card className="text-center p-8">
          <p className="text-muted-foreground">Gelijkreeks niet gevonden</p>
        </Card>
      </div>
    );
  }

  // Group lessons by level
  const lessonsByLevel: Record<number, typeof course.lessons> = {};
  course.lessons.forEach((lesson) => {
    if (!lessonsByLevel[lesson.level_number]) {
      lessonsByLevel[lesson.level_number] = [];
    }
    lessonsByLevel[lesson.level_number].push(lesson);
  });

  const sortedLevels = Object.keys(lessonsByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back navigation */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/teacher/courses`}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{course.name}</h1>
        {course.description && (
          <p className="text-muted-foreground">{course.description}</p>
        )}
        <div className="flex items-center gap-2">
          {course.is_active ? (
            <Badge variant="default" className="bg-green-500">
              Actief
            </Badge>
          ) : (
            <Badge variant="outline">Inactief</Badge>
          )}
        </div>
      </div>

      {/* Course stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totaal lessen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{course.total_lessons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totaal niveaus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{course.total_levels}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Geplande lessen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{course.lessons.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/${locale}/teacher/courses/${courseId}/lessons`}>
            Lessen beheren
          </Link>
        </Button>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Lessons grid */}
      <div className="space-y-6">
        {sortedLevels.map((level) => (
          <Card key={level}>
            <CardHeader>
              <CardTitle className="text-base">Niveau {level}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {lessonsByLevel[level]
                  ?.sort((a, b) => a.lesson_number - b.lesson_number)
                  .map((lesson) => (
                    <div
                      key={lesson.id}
                      className="rounded-lg border p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">
                          Les {lesson.lesson_number}
                        </h4>
                        <Badge variant="secondary">
                          #{lesson.sort_order}
                        </Badge>
                      </div>
                      {lesson.title && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {lesson.title}
                        </p>
                      )}
                      {lesson.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {lesson.description}
                        </p>
                      )}
                      {(lesson.video_url || lesson.audio_url) && (
                        <div className="flex gap-2 mt-2">
                          {lesson.video_url && (
                            <Badge variant="outline" className="text-xs">
                              Video
                            </Badge>
                          )}
                          {lesson.audio_url && (
                            <Badge variant="outline" className="text-xs">
                              Audio
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No lessons state */}
      {course.lessons.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nog geen lessen. Voeg lessen toe in lessen beheren.
          </p>
        </Card>
      )}
    </div>
  );
}
