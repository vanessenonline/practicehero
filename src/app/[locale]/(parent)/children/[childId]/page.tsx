import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChildren } from "@/lib/actions/family";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Flame, MessageCircle, Music } from "lucide-react";
import { ChildSettingsCard } from "./ChildSettingsCard";
import type { DayOfWeek } from "@/types/database";

/**
 * Individual child management page.
 * Shows details and allows the parent to view stats and send messages.
 */
export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  const t = await getTranslations();

  // Verify the child belongs to this parent's family
  const { children } = await getChildren();
  const child = children.find((c) => c.profile.id === childId);

  if (!child) {
    notFound();
  }

  const { profile, instruments, streak } = child;

  const INSTRUMENT_ICONS: Record<string, string> = {
    piano: "🎹",
    drums: "🥁",
    guitar: "🎸",
    keyboard: "🎹",
    violin: "🎻",
  };

  const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // Fetch this week's practice sessions for the child
  const supabase = await createClient();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("child_id", childId)
    .gte("started_at", monday.toISOString())
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
  (sessions ?? []).forEach((s) => {
    const d = new Date(s.started_at);
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    weeklyMinutes[idx] += Math.round((s.duration_seconds ?? 0) / 60);
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const practicedToday = (sessions ?? []).some(
    (s) => new Date(s.started_at) >= todayStart
  );

  const totalMinutesThisWeek = weeklyMinutes.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/children`}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-purple-500 text-2xl font-bold text-white">
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          {streak && (
            <div className="flex items-center gap-1.5 text-orange-500">
              <Flame className="h-4 w-4" />
              <span className="font-medium">
                {streak.current_count} {t("common.days")} streak
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center py-3">
            <p className="text-2xl font-bold text-orange-500">
              {streak?.current_count ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-3">
            <p className="text-2xl font-bold">{totalMinutesThisWeek}</p>
            <p className="text-xs text-muted-foreground">Min deze week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-3">
            <p className="text-2xl font-bold text-green-600">
              {practicedToday ? "✓" : "–"}
            </p>
            <p className="text-xs text-muted-foreground">Vandaag</p>
          </CardContent>
        </Card>
      </div>

      {/* Instruments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Instrumenten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instruments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {instruments.map((ci) => (
                <Badge key={ci.id} variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                  <span>{INSTRUMENT_ICONS[ci.instrument.name_key] ?? "🎵"}</span>
                  {t(`instruments.${ci.instrument.name_key}` as Parameters<typeof t>[0])}
                  {ci.is_primary && <span className="text-orange-500">★</span>}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen instrument ingesteld</p>
          )}
        </CardContent>
      </Card>

      {/* Weekly progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("parent.dashboard.weeklyProgress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            {dayLabels.map((day, i) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative h-20 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="absolute bottom-0 w-full rounded-sm bg-gradient-to-t from-orange-500 to-orange-400 transition-all"
                    style={{
                      height: `${Math.min(100, ((weeklyMinutes[i] ?? 0) / 30) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{day}</span>
                {(weeklyMinutes[i] ?? 0) > 0 && (
                  <span className="text-[9px] font-medium text-orange-600">
                    {weeklyMinutes[i]}m
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Child-specific settings (messaging, goal, days) */}
      <ChildSettingsCard
        childId={profile.id}
        canSendMessages={profile.can_send_messages ?? false}
        dailyGoalMinutes={profile.daily_goal_minutes ?? 15}
        practiceDays={(profile.practice_days as DayOfWeek[]) ?? ["mon", "tue", "wed", "thu", "fri"]}
      />

      {/* Actions */}
      <div className="space-y-2">
        <Button asChild className="w-full gap-2">
          <Link href={`/${locale}/inbox?to=${profile.id}`}>
            <MessageCircle className="h-4 w-4" />
            {t("parent.dashboard.sendMessage")} naar {profile.display_name}
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full gap-2">
          <Link href={`/${locale}/children/${profile.id}/content`}>
            <Music className="h-4 w-4" />
            Lesinhoud beheren
          </Link>
        </Button>
      </div>
    </div>
  );
}
