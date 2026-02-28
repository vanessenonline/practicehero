"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Globe,
  Palette,
  Bell,
  CheckCircle2,
  Loader2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { updateSettings } from "@/lib/actions/settings";
import type { Profile, Theme, DayOfWeek } from "@/types/database";

interface SettingsClientProps {
  profile: Profile;
}

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Interactive settings form for parents.
 * Sections: Profile, Appearance, Notifications.
 */
export function SettingsClient({ profile }: SettingsClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [locale, setLocale] = useState(profile.locale);
  const [theme, setTheme] = useState<Theme>(profile.theme);
  const [dailyGoal, setDailyGoal] = useState(profile.daily_goal_minutes);
  const [practiceDays, setPracticeDays] = useState<DayOfWeek[]>(profile.practice_days);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.notifications_enabled);
  const [streakReminder, setStreakReminder] = useState(profile.notification_streak_reminder);
  const [achievementAlerts, setAchievementAlerts] = useState(profile.notification_achievement);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDay(day: DayOfWeek) {
    setPracticeDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateSettings({
        display_name: displayName,
        locale,
        theme,
        daily_goal_minutes: dailyGoal,
        practice_days: practiceDays,
        notifications_enabled: notificationsEnabled,
        notification_streak_reminder: streakReminder,
        notification_achievement: achievementAlerts,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const themeOptions: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: "light", icon: Sun, labelKey: "settings.themeLight" },
    { value: "dark", icon: Moon, labelKey: "settings.themeDark" },
    { value: "system", icon: Monitor, labelKey: "settings.themeSystem" },
  ];

  return (
    <div className="space-y-4">
      {/* Profile section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            {t("settings.profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">{t("settings.displayName")}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings.displayName")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settings.language")}</Label>
            <div className="flex gap-2">
              {(["nl", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLocale(lang)}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    locale === lang
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {lang === "nl" ? "Nederlands" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.account")}</Label>
            <p className="text-sm text-muted-foreground">
              {profile.auth_email ?? "–"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Appearance section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            {t("settings.appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.theme")}</Label>
            <div className="flex gap-2">
              {themeOptions.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                    theme === value
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Practice defaults section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            🎵 {t("settings.practice")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dailyGoal">{t("settings.dailyGoal")}</Label>
            <div className="flex items-center gap-3">
              <Input
                id="dailyGoal"
                type="number"
                min={5}
                max={120}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                {t("common.minutes")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.practiceDays")}</Label>
            <div className="flex gap-1.5">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    practiceDays.includes(day)
                      ? "bg-orange-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t(`days.${day}`)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            {t("settings.notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label={t("settings.notificationsEnabled")}
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
          {notificationsEnabled && (
            <>
              <ToggleRow
                label={t("settings.streakReminder")}
                checked={streakReminder}
                onChange={setStreakReminder}
              />
              <ToggleRow
                label={t("settings.achievementAlerts")}
                checked={achievementAlerts}
                onChange={setAchievementAlerts}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}

      <Button
        onClick={handleSave}
        disabled={isPending}
        className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
        size="lg"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : null}
        {saved ? t("settings.saved") : t("common.save")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle row helper
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-accent"
    >
      <span className="text-sm">{label}</span>
      <div
        className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
          checked ? "bg-orange-500" : "bg-muted"
        }`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}
