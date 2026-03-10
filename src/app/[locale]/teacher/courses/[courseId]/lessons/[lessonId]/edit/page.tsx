import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { getLessonById } from "@/lib/actions/teacher";
import { LessonForm } from "../../LessonForm";

/**
 * Edit an existing course lesson.
 */
export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; lessonId: string }>;
}) {
  const { locale, courseId, lessonId } = await params;

  const { lesson, error } = await getLessonById(lessonId);

  if (error || !lesson) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/courses/${courseId}/lessons`}>
            <ChevronLeft className="h-4 w-4" />
            Terug naar lessen
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Les niet gevonden"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/teacher/courses/${courseId}/lessons`}>
          <ChevronLeft className="h-4 w-4" />
          Terug naar lessen
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Les bewerken</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Niveau {lesson.level_number} — Les {lesson.lesson_number}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <LessonForm
            courseId={courseId}
            lessonNumber={lesson.lesson_number}
            levelNumber={lesson.level_number}
            existingLesson={lesson}
          />
        </CardContent>
      </Card>
    </div>
  );
}
