import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Flame, Trophy, Coins, MessageCircle, BookOpen } from "lucide-react";
import { getStudentDetail, getCourses } from "@/lib/actions/teacher";
import { createClient } from "@/lib/supabase/server";
import { StudentMessagingToggle } from "./StudentMessagingToggle";
import { StudentCourseCard } from "./StudentCourseCard";

/**
 * Student detail page – shows student profile, current progress, and practice history.
 * Displays streak, points, credits, and recent practice sessions.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string }>;
}) {
  const { locale, studentId } = await params;
  const t = await getTranslations();

  const [{ student, error }, courses] = await Promise.all([
    getStudentDetail(studentId),
    getCourses(),
  ]);

  // Fetch recent practice sessions
  let recentSessions: any[] = [];
  if (student) {
    const supabase = await createClient();
    const { data: sessions } = await supabase
      .from("practice_sessions")
      .select(
        "id, instrument_id, duration_seconds, started_at, status, instruments(name_key)"
      )
      .eq("child_id", studentId)
      .order("started_at", { ascending: false })
      .limit(10);

    recentSessions = sessions || [];
  }

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

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "—";
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/students`}>
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

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/students`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
        <Card className="text-center p-8">
          <p className="text-muted-foreground">Leerling niet gevonden</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back navigation */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/teacher/students`}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{student.name}</h1>
        <p className="text-sm text-muted-foreground">
          Leerlingcode: <code className="font-mono font-bold">{student.student_code}</code>
        </p>
        <p className="text-sm text-muted-foreground">
          Niveau {student.current_level} • Les {student.current_lesson}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Streak */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{student.streak_count ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">dagen opeenvolging</p>
          </CardContent>
        </Card>

        {/* Points */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Punten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{student.total_points ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">totaal verdiend</p>
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4 text-cyan-500" />
              Tegoed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{student.total_credits ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">super credits</p>
          </CardContent>
        </Card>
      </div>

      {/* Course assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-500" />
            Cursus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentCourseCard
            studentId={studentId}
            initialCourseId={student.course_id ?? null}
            initialCourseName={student.course_name ?? null}
            initialLevel={student.current_level}
            initialLesson={student.current_lesson}
            initialLessonTitle={student.current_lesson_title ?? null}
            courses={courses}
          />
        </CardContent>
      </Card>

      {/* Messaging settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            {t("teacher.students.messaging")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentMessagingToggle
            studentId={studentId}
            initialCanSend={student.can_send_messages ?? false}
          />
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inschrijving</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Startdatum:</span>
            <span>
              {new Date(student.start_date).toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          {student.target_end_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Einddatum:</span>
              <span>
                {new Date(student.target_end_date).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={student.is_active ? "default" : "outline"}>
              {student.is_active ? "Actief" : "Inactief"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Recent practice sessions */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recente oefensessies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {instIcon(session.instruments?.name_key || "piano")}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {session.instruments?.name_key}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.started_at).toLocaleDateString(
                          locale,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={session.status === "completed" ? "default" : "outline"}
                    >
                      {session.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
