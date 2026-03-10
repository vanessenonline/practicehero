import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { LessonForm } from "../LessonForm";

/**
 * Add a lesson to a course at a specific level/lesson position.
 * Position is passed via ?level=X&lesson=Y query params (set by the lessons grid).
 */
export default async function AddLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ level?: string; lesson?: string }>;
}) {
  const { locale, courseId } = await params;
  const { level, lesson } = await searchParams;

  const levelNumber = Math.max(1, parseInt(level ?? "1", 10));
  const lessonNumber = Math.max(1, parseInt(lesson ?? "1", 10));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/teacher/courses/${courseId}/lessons`}>
          <ChevronLeft className="h-4 w-4" />
          Terug naar lessen
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Les toevoegen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Niveau {levelNumber} — Les {lessonNumber}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <LessonForm
            courseId={courseId}
            lessonNumber={lessonNumber}
            levelNumber={levelNumber}
          />
        </CardContent>
      </Card>
    </div>
  );
}
