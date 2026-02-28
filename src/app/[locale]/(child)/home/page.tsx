import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Zap, Music, MessageCircle, Trophy } from "lucide-react";
import { getChildDashboard } from "@/lib/actions/child";

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

/**
 * Child home/dashboard page – server component with real Supabase data.
 * Shows streak, points, super credits, today's practice mission,
 * weekly progress, and unread message count.
 */
export default async function ChildHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const { dashboard, error } = await getChildDashboard();

  // Fallback when data can't be loaded
  if (!dashboard || error) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {error ?? "Kon gegevens niet laden"}
      </div>
    );
  }

  const {
    profile,
    instruments,
    streak,
    totalPoints,
    superCredits,
    practicedToday,
    weeklyMinutes,
    unreadMessages,
  } = dashboard;

  const streakCount = streak?.current_count ?? 0;
  // Points needed until next super credit conversion (every 10 pts = 1 credit)
  const pointsToNextCredit = 10 - (totalPoints % 10);

  const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
  const today = new Date();
  // 0=Sun → map to Mon-based index
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="py-2 text-center">
        <h1 className="text-2xl font-bold">
          Hey {profile.display_name}! 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("practice.title")}
        </p>
      </div>

      {/* Streak card */}
      <Card className="overflow-hidden border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <Flame className="h-7 w-7 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {streakCount}
              </p>
              <p className="text-xs text-orange-600/70">
                {t("streak.current", { count: streakCount })}
              </p>
            </div>
          </div>
          {streakCount >= 10 && (
            <Badge className="bg-orange-500 text-white">
              <Trophy className="mr-1 h-3 w-3" />
              {t("streak.newRecord")}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Points & Credits row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <Star className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-bold">{totalPoints}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("common.points")}
              </p>
            </div>
            {/* Progress toward next super credit */}
            <div className="ml-auto flex flex-col items-end gap-0.5">
              <Progress
                value={((10 - pointsToNextCredit) / 10) * 100}
                className="h-1.5 w-12"
              />
              <span className="text-[9px] text-muted-foreground">
                nog {pointsToNextCredit}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <Zap className="h-5 w-5 text-purple-500" />
            <div>
              <p className="font-bold">{superCredits}</p>
              <p className="text-[10px] text-muted-foreground">
                Super Credits
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's practice mission */}
      <Card className={practicedToday ? "border-green-200 bg-green-50" : ""}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Music className="h-4 w-4" />
              {t("practice.selectInstrument")}
            </h2>
            {practicedToday && (
              <Badge variant="default" className="bg-green-500">
                ✓ {t("parent.dashboard.practiced")}
              </Badge>
            )}
          </div>

          {instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen instrumenten gekoppeld. Vraag een ouder om een instrument toe te voegen.
            </p>
          ) : (
            <div className="grid gap-2">
              {instruments.map((ci) => (
                <Link
                  key={ci.id}
                  href={`/${locale}/practice/${ci.instrument_id}`}
                >
                  <Button
                    variant="outline"
                    className="h-14 w-full justify-start gap-3 text-base"
                    disabled={practicedToday}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-2xl">
                      {instIcon(ci.instrument.name_key)}
                    </div>
                    <span>
                      {t(
                        `instruments.${ci.instrument.name_key}` as Parameters<
                          typeof t
                        >[0]
                      )}
                    </span>
                    {ci.is_primary && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        Primair
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly overview */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {t("parent.dashboard.weeklyProgress")}
          </h3>
          <div className="flex gap-1.5">
            {dayLabels.map((day, i) => {
              const minutes = weeklyMinutes[i] ?? 0;
              const isToday = i === todayIndex;
              const hasPractice = minutes > 0;
              // Scale: 30 min = 100%
              const heightPct = Math.min(100, (minutes / 30) * 100);

              return (
                <div
                  key={day}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="relative h-10 w-full overflow-hidden rounded-md bg-muted">
                    {hasPractice && (
                      <div
                        className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-orange-500 to-orange-400 transition-all"
                        style={{ height: `${heightPct}%` }}
                      />
                    )}
                    {isToday && !hasPractice && (
                      <div className="absolute inset-0 animate-pulse rounded-md bg-orange-200" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] ${
                      isToday ? "font-bold text-orange-600" : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Messages shortcut */}
      {unreadMessages > 0 && (
        <Link href={`/${locale}/messages`}>
          <Card className="cursor-pointer border-blue-200 bg-blue-50 transition-colors hover:bg-blue-100">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-700">
                  {unreadMessages} nieuw{unreadMessages !== 1 ? "e" : ""} bericht{unreadMessages !== 1 ? "en" : ""}
                </p>
                <p className="text-xs text-blue-600">van je ouder</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
