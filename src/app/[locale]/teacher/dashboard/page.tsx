import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Flame, Music } from "lucide-react";
import { getTeacherDashboard } from "@/lib/actions/teacher";
import { CopyButton } from "@/components/teacher/CopyButton";

/**
 * Teacher dashboard – displays studio overview, student count, and recent practice activity.
 * Shows teacher code for student registration and quick stats on practice engagement.
 */
export default async function TeacherDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const { studio, error: dashboardError, recentSessions = [] } = await getTeacherDashboard();

  // Map instrument name_key to emoji
  function instIcon(nameKey: string | null): string {
    const icons: Record<string, string> = {
      piano: "🎹",
      drums: "🥁",
      guitar: "🎸",
      keyboard: "🎹",
      violin: "🎻",
      trumpet: "🎺",
    };
    return nameKey ? (icons[nameKey] ?? "🎵") : "🎵";
  }

  // Format duration
  function formatDuration(seconds: number | null): string {
    if (!seconds) return "—";
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.teacher.dashboard")}</h1>
          {studio && (
            <p className="text-sm text-muted-foreground">{studio.name}</p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/teacher/students/add`}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("teacher.students.add")}
          </Link>
        </Button>
      </div>

      {/* Error state */}
      {dashboardError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}: {dashboardError}
        </div>
      )}

      {/* Studio info & stats */}
      {studio && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Studio info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("teacher.studio.code")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <code className="text-2xl font-bold tracking-wider font-mono">
                  {studio.teacher_code}
                </code>
                {/* CopyButton is a Client Component — onClick not allowed in Server Components */}
                <CopyButton text={studio.teacher_code} label="Kopieer code" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("teacher.studio.shareCode")}
              </p>
            </CardContent>
          </Card>

          {/* Student count card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("teacher.dashboard.studentCount")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-500" />
                <span className="text-3xl font-bold">{studio.student_count}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {studio.student_count === 1 ? "leerling" : "leerlingen"}
              </p>
            </CardContent>
          </Card>

          {/* Practiced today card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("teacher.dashboard.practicedToday")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <span className="text-3xl font-bold">{studio.practiced_today}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {studio.practiced_today === 1 ? "leerling geoefend" : "leerlingen geoefend"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent practice sessions */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("teacher.dashboard.recentSessions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">
                      {instIcon(session.instrument_name_key)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{session.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.started_at).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={session.status === "completed" ? "default" : "outline"}
                    >
                      {session.status}
                    </Badge>
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {studio && studio.student_count === 0 && (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Music className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">{t("teacher.dashboard.noStudents")}</p>
              <p className="text-sm text-muted-foreground">
                {t("teacher.dashboard.noStudentsHint")}
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
    </div>
  );
}
