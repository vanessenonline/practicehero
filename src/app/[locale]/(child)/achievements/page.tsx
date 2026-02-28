import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Achievements/badges page – server component with real Supabase data.
 * Shows all achievements and which ones the child has unlocked.
 */
export default async function AchievementsPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Niet ingelogd
      </div>
    );
  }

  // Fetch all achievements + child's unlocked ones in parallel
  const [achievementsResult, unlockedResult] = await Promise.all([
    supabase.from("achievements").select("*").order("category").order("threshold"),
    supabase
      .from("child_achievements")
      .select("achievement_id, unlocked_at")
      .eq("child_id", user.id),
  ]);

  const allAchievements = achievementsResult.data ?? [];
  const unlocked = unlockedResult.data ?? [];
  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id));
  const unlockedCount = unlockedIds.size;

  // Group by category
  const categories: Record<string, typeof allAchievements> = {};
  allAchievements.forEach((a) => {
    if (!categories[a.category]) categories[a.category] = [];
    categories[a.category].push(a);
  });

  const categoryLabels: Record<string, string> = {
    special: "⭐ Speciaal",
    streak: "🔥 Streak",
    time: "⏱️ Tijd",
    points: "⚡ Punten",
    instrument: "🎵 Instrument",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="py-2 text-center">
        <h1 className="text-2xl font-bold">{t("achievements.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {unlockedCount} / {allAchievements.length}{" "}
          {t("achievements.unlocked").toLowerCase()}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all"
          style={{
            width: `${allAchievements.length > 0 ? (unlockedCount / allAchievements.length) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Achievement grid by category */}
      {Object.entries(categories).map(([category, items]) => (
        <div key={category}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {categoryLabels[category] ?? category}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {items.map((achievement) => {
              const isUnlocked = unlockedIds.has(achievement.id);
              const unlockedEntry = unlocked.find(
                (u) => u.achievement_id === achievement.id
              );

              return (
                <Card
                  key={achievement.id}
                  className={`overflow-hidden transition-all ${
                    isUnlocked
                      ? "border-orange-200 bg-gradient-to-b from-orange-50 to-amber-50"
                      : "opacity-40 grayscale"
                  }`}
                >
                  <CardContent className="flex flex-col items-center gap-1.5 p-3 text-center">
                    {/* Achievement icon (emoji from DB) */}
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                        isUnlocked
                          ? "bg-gradient-to-br from-orange-400 to-amber-500"
                          : "bg-muted"
                      }`}
                    >
                      {achievement.icon}
                    </div>

                    {/* Name */}
                    <span className="text-[11px] font-medium leading-tight">
                      {achievement.name_key}
                    </span>

                    {/* Unlocked date or locked hint */}
                    {isUnlocked && unlockedEntry ? (
                      <span className="text-[9px] text-orange-600">
                        {new Date(unlockedEntry.unlocked_at).toLocaleDateString(
                          "nl-NL",
                          { day: "numeric", month: "short" }
                        )}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">
                        🔒
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {allAchievements.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          Nog geen achievements beschikbaar
        </div>
      )}
    </div>
  );
}
