"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Settings } from "lucide-react";
import { updateChildSettings } from "@/lib/actions/settings";
import type { DayOfWeek } from "@/types/database";

interface ChildSettingsCardProps {
  childId: string;
  canSendMessages: boolean;
  dailyGoalMinutes: number;
  practiceDays: DayOfWeek[];
}

const ALL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Card component for per-child settings managed by the parent.
 * Includes messaging toggle, daily goal, and practice days.
 */
export function ChildSettingsCard({
  childId,
  canSendMessages: initialCanSend,
  dailyGoalMinutes: initialGoal,
  practiceDays: initialDays,
}: ChildSettingsCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [canSend, setCanSend] = useState(initialCanSend);
  const [dailyGoal, setDailyGoal] = useState(initialGoal);
  const [days, setDays] = useState<DayOfWeek[]>(initialDays);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDay(day: DayOfWeek) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateChildSettings(childId, {
        can_send_messages: canSend,
        daily_goal_minutes: dailyGoal,
        practice_days: days,
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Settings className="h-4 w-4" />
          {t("settings.childSettings")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Can send messages toggle */}
        <button
          onClick={() => setCanSend(!canSend)}
          className="flex w-full items-center justify-between rounded-lg py-1 text-left"
        >
          <div>
            <p className="text-sm font-medium">{t("settings.canSendMessages")}</p>
            <p className="text-xs text-muted-foreground">
              {t("settings.canSendMessagesHelp")}
            </p>
          </div>
          <div
            className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
              canSend ? "bg-orange-500" : "bg-muted"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                canSend ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </button>

        {/* Daily goal */}
        <div className="space-y-2">
          <Label htmlFor={`goal-${childId}`} className="text-sm">
            {t("settings.dailyGoal")}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id={`goal-${childId}`}
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

        {/* Practice days */}
        <div className="space-y-2">
          <Label className="text-sm">{t("settings.practiceDays")}</Label>
          <div className="flex gap-1.5">
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  days.includes(day)
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t(`days.${day}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={isPending}
          size="sm"
          className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : null}
          {saved ? t("settings.saved") : t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
