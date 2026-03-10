import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, MessageCircle, UserPlus, Music, BookOpen } from "lucide-react";
import { getFamilyOverview } from "@/lib/actions/family";

/**
 * Parent dashboard – server component that fetches real data from Supabase.
 * Shows all children's practice status, streak, and this week's progress.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const { familyName, children, error } = await getFamilyOverview();

  const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // Map instrument name_key to emoji icon
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
          <h1 className="text-2xl font-bold">{t("parent.dashboard.title")}</h1>
          {familyName && (
            <p className="text-sm text-muted-foreground">Familie {familyName}</p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/children/add`}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("parent.children.add")}
          </Link>
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}: {error}
        </div>
      )}

      {/* Empty state */}
      {!error && children.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <Music className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold">Nog geen kinderen</p>
              <p className="text-sm text-muted-foreground">
                Voeg je eerste kind toe om te beginnen
              </p>
            </div>
            <Button asChild>
              <Link href={`/${locale}/children/add`}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {t("parent.children.add")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Children grid */}
      {children.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map(({ profile, instruments, streak, practicedToday, weeklyMinutes, courseProgress }) => (
            <Card key={profile.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{profile.display_name}</CardTitle>
                  <div className="flex items-center gap-1.5 text-orange-500">
                    <Flame className="h-5 w-5" />
                    <span className="font-bold">
                      {streak?.current_count ?? 0}
                    </span>
                  </div>
                </div>

                {/* Instrument badges */}
                <div className="flex flex-wrap gap-1.5">
                  {instruments.length > 0 ? (
                    instruments.map((ci) => (
                      <Badge key={ci.id} variant="secondary" className="gap-1">
                        <span>{instIcon(ci.instrument.name_key)}</span>
                        {t(`instruments.${ci.instrument.name_key}` as Parameters<typeof t>[0])}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Geen instrument
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Today's status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("parent.dashboard.todayStatus")}
                  </span>
                  <Badge variant={practicedToday ? "default" : "outline"}>
                    {practicedToday
                      ? t("parent.dashboard.practiced") + " ✓"
                      : t("parent.dashboard.notYet")}
                  </Badge>
                </div>

                {/* Course progress (when child is enrolled via a teacher) */}
                {courseProgress && (
                  <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 p-2.5">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-purple-700 truncate">
                        {courseProgress.courseName}
                      </p>
                      <p className="text-[11px] text-purple-600/70">
                        Niveau {courseProgress.currentLevel} — Les{" "}
                        {courseProgress.currentLesson}
                        {courseProgress.lessonTitle && (
                          <>: {courseProgress.lessonTitle}</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Weekly progress bars */}
                <div>
                  <span className="text-sm text-muted-foreground">
                    {t("parent.dashboard.weeklyProgress")}
                  </span>
                  <div className="mt-2 flex gap-1">
                    {dayLabels.map((day, i) => (
                      <div key={day} className="flex flex-1 flex-col items-center gap-1">
                        <div className="relative h-16 w-full overflow-hidden rounded-sm bg-muted">
                          <div
                            className="absolute bottom-0 w-full rounded-sm bg-gradient-to-t from-orange-500 to-orange-400 transition-all"
                            style={{
                              height: `${Math.min(100, ((weeklyMinutes[i] ?? 0) / 30) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                  >
                    <Link href={`/${locale}/inbox?to=${profile.id}`}>
                      <MessageCircle className="h-4 w-4" />
                      {t("parent.dashboard.sendMessage")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                  >
                    <Link href={`/${locale}/children/${profile.id}`}>
                      Beheer
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
