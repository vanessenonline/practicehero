"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Sparkles,
  Loader2,
  CheckCircle2,
  Video,
  Music,
  Search,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { saveContent, reuseAsChallenge, getContentHistory } from "@/lib/actions/content";
import type { Instrument, PracticeContent } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstrumentContent {
  instrument: Instrument;
  lesson: PracticeContent | null;
  motivator: PracticeContent | null;
}

interface ContentFormProps {
  childId: string;
  childName: string;
  instrumentContent: InstrumentContent[];
}

interface FormFields {
  lessonTitle: string;
  lessonDescription: string;
  motivatorTitle: string;
  motivatorDescription: string;
  videoUrl: string;
  audioUrl: string;
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTRUMENT_ICONS: Record<string, string> = {
  piano: "🎹",
  drums: "🥁",
  guitar: "🎸",
  keyboard: "🎹",
  violin: "🎻",
  trumpet: "🎺",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a YouTube video ID from various URL formats.
 * Returns null if the URL is not a recognized YouTube URL.
 */
function extractYouTubeId(url: string): string | null {
  if (!url.trim()) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      // /watch?v=ID or /embed/ID
      const vParam = parsed.searchParams.get("v");
      if (vParam) return vParam;
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Get the Monday of the week containing the given date.
 */
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

/**
 * Get the Sunday of the week containing the given date.
 */
function getSunday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 6;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

/**
 * Format a date string (YYYY-MM-DD) to a short display format.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client form component for managing a child's practice content (per instrument).
 * Allows the parent to set lessons, motivators, media links, and week scheduling.
 * Includes a content history section to reuse past lessons as challenges.
 */
export function ContentForm({
  childId,
  childName,
  instrumentContent,
}: ContentFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Track saved/error state per instrument
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Map<string, string>>(new Map());

  // History state per instrument
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<
    Record<string, PracticeContent[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set());

  // Per-instrument form state: map instrumentId → field values
  const [formData, setFormData] = useState<Record<string, FormFields>>(() => {
    const now = new Date();
    const defaultStart = getMonday(now);
    const defaultEnd = getSunday(now);

    return Object.fromEntries(
      instrumentContent.map(({ instrument, lesson, motivator }) => [
        instrument.id,
        {
          lessonTitle: lesson?.title ?? "",
          lessonDescription: lesson?.description ?? "",
          motivatorTitle: motivator?.title ?? "",
          motivatorDescription: motivator?.description ?? "",
          videoUrl: lesson?.video_url ?? "",
          audioUrl: motivator?.audio_url ?? "",
          startDate: lesson?.start_date ?? defaultStart,
          endDate: lesson?.end_date ?? defaultEnd,
        },
      ])
    );
  });

  function updateField(
    instrumentId: string,
    field: keyof FormFields,
    value: string
  ) {
    setFormData((prev) => ({
      ...prev,
      [instrumentId]: { ...prev[instrumentId], [field]: value },
    }));
    // Clear saved/error state on change
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(instrumentId);
      return next;
    });
    setErrorIds((prev) => {
      const next = new Map(prev);
      next.delete(instrumentId);
      return next;
    });
  }

  function handleSave(instrumentId: string) {
    const data = formData[instrumentId];
    if (!data) return;

    startTransition(async () => {
      const result = await saveContent({
        childId,
        instrumentId,
        lessonTitle: data.lessonTitle,
        lessonDescription: data.lessonDescription,
        motivatorTitle: data.motivatorTitle,
        motivatorDescription: data.motivatorDescription,
        videoUrl: data.videoUrl || undefined,
        audioUrl: data.audioUrl || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      });

      if (result.error) {
        setErrorIds((prev) => new Map(prev).set(instrumentId, result.error!));
      } else {
        setSavedIds((prev) => new Set(prev).add(instrumentId));
        router.refresh();
      }
    });
  }

  /**
   * Toggle history section and load history data if needed.
   */
  const toggleHistory = useCallback(
    async (instrumentId: string) => {
      const isOpen = historyOpen.has(instrumentId);

      if (isOpen) {
        setHistoryOpen((prev) => {
          const next = new Set(prev);
          next.delete(instrumentId);
          return next;
        });
        return;
      }

      // Open and load if not already loaded
      setHistoryOpen((prev) => new Set(prev).add(instrumentId));

      if (!historyData[instrumentId]) {
        setHistoryLoading((prev) => new Set(prev).add(instrumentId));
        const result = await getContentHistory(childId, instrumentId);
        setHistoryData((prev) => ({
          ...prev,
          [instrumentId]: result.history,
        }));
        setHistoryLoading((prev) => {
          const next = new Set(prev);
          next.delete(instrumentId);
          return next;
        });
      }
    },
    [childId, historyData, historyOpen]
  );

  /**
   * Reuse a historical content item as a new motivator challenge.
   */
  function handleReuse(sourceContentId: string, instrumentId: string) {
    startTransition(async () => {
      const result = await reuseAsChallenge(sourceContentId, childId, instrumentId);
      if (result.error) {
        setErrorIds((prev) => new Map(prev).set(instrumentId, result.error!));
      } else {
        setSavedIds((prev) => new Set(prev).add(instrumentId));
        router.refresh();
      }
    });
  }

  /**
   * Open YouTube search in a new tab with pre-filled query.
   */
  function searchYouTube(instrumentId: string) {
    const data = formData[instrumentId];
    const instrumentName =
      instrumentContent.find((ic) => ic.instrument.id === instrumentId)
        ?.instrument.name_key ?? "";
    const query = [instrumentName, data?.lessonTitle]
      .filter(Boolean)
      .join(" ");
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      "_blank"
    );
  }

  if (instrumentContent.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {childName} heeft nog geen instrumenten gekoppeld.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {instrumentContent.map(({ instrument }) => {
        const data = formData[instrument.id] ?? {
          lessonTitle: "",
          lessonDescription: "",
          motivatorTitle: "",
          motivatorDescription: "",
          videoUrl: "",
          audioUrl: "",
          startDate: getMonday(new Date()),
          endDate: getSunday(new Date()),
        };
        const isSaved = savedIds.has(instrument.id);
        const errorMsg = errorIds.get(instrument.id);
        const isHistoryOpen = historyOpen.has(instrument.id);
        const history = historyData[instrument.id] ?? [];
        const isHistoryLoading = historyLoading.has(instrument.id);
        const youtubeId = extractYouTubeId(data.videoUrl);

        return (
          <Card key={instrument.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">
                  {INSTRUMENT_ICONS[instrument.name_key] ?? "🎵"}
                </span>
                {t(
                  `instruments.${instrument.name_key}` as Parameters<
                    typeof t
                  >[0]
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Week scheduling */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {t("parent.content.weekSchedule")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`start-date-${instrument.id}`}>
                      {t("parent.content.startDate")}
                    </Label>
                    <Input
                      id={`start-date-${instrument.id}`}
                      type="date"
                      value={data.startDate}
                      onChange={(e) =>
                        updateField(instrument.id, "startDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`end-date-${instrument.id}`}>
                      {t("parent.content.endDate")}
                    </Label>
                    <Input
                      id={`end-date-${instrument.id}`}
                      type="date"
                      value={data.endDate}
                      onChange={(e) =>
                        updateField(instrument.id, "endDate", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Lesson */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  {t("parent.content.currentLesson")}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`lesson-title-${instrument.id}`}>
                    {t("parent.content.lessonTitle")}
                  </Label>
                  <Input
                    id={`lesson-title-${instrument.id}`}
                    placeholder="bijv. Week 5 – Ode to Joy"
                    value={data.lessonTitle}
                    onChange={(e) =>
                      updateField(instrument.id, "lessonTitle", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`lesson-desc-${instrument.id}`}>
                    {t("parent.content.lessonDescription")}
                  </Label>
                  <Textarea
                    id={`lesson-desc-${instrument.id}`}
                    placeholder="bijv. Oefen de rechterhand melodie, let op vingerpositie"
                    value={data.lessonDescription}
                    onChange={(e) =>
                      updateField(
                        instrument.id,
                        "lessonDescription",
                        e.target.value
                      )
                    }
                    rows={2}
                    className="resize-none"
                  />
                </div>

                {/* YouTube video URL */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`video-url-${instrument.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <Video className="h-3.5 w-3.5 text-red-500" />
                    {t("parent.content.videoUrl")}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`video-url-${instrument.id}`}
                      placeholder={t("parent.content.videoUrlPlaceholder")}
                      value={data.videoUrl}
                      onChange={(e) =>
                        updateField(instrument.id, "videoUrl", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => searchYouTube(instrument.id)}
                      title={t("parent.content.searchYouTube")}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* YouTube thumbnail preview */}
                  {youtubeId && (
                    <div className="mt-2 overflow-hidden rounded-md border">
                      <img
                        src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                        alt="YouTube thumbnail"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Motivator */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-600">
                  <Sparkles className="h-4 w-4" />
                  {t("parent.content.motivator")}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`motivator-title-${instrument.id}`}>
                    {t("parent.content.motivatorTitle")}
                  </Label>
                  <Input
                    id={`motivator-title-${instrument.id}`}
                    placeholder="bijv. G Majeur akkoord"
                    value={data.motivatorTitle}
                    onChange={(e) =>
                      updateField(
                        instrument.id,
                        "motivatorTitle",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`motivator-desc-${instrument.id}`}>
                    {t("parent.content.lessonDescription")}
                  </Label>
                  <Textarea
                    id={`motivator-desc-${instrument.id}`}
                    placeholder="bijv. Leer dit akkoord als uitdaging voor deze week"
                    value={data.motivatorDescription}
                    onChange={(e) =>
                      updateField(
                        instrument.id,
                        "motivatorDescription",
                        e.target.value
                      )
                    }
                    rows={2}
                    className="resize-none"
                  />
                </div>

                {/* Spotify audio URL */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`audio-url-${instrument.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <Music className="h-3.5 w-3.5 text-green-500" />
                    {t("parent.content.audioUrl")}
                  </Label>
                  <Input
                    id={`audio-url-${instrument.id}`}
                    placeholder={t("parent.content.audioUrlPlaceholder")}
                    value={data.audioUrl}
                    onChange={(e) =>
                      updateField(instrument.id, "audioUrl", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Error */}
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}

              {/* Save button */}
              <Button
                onClick={() => handleSave(instrument.id)}
                disabled={isPending}
                className="w-full"
                variant={isSaved ? "outline" : "default"}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    {t("parent.content.saved")}
                  </>
                ) : (
                  t("common.save")
                )}
              </Button>

              {/* Divider */}
              <div className="border-t" />

              {/* History section */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleHistory(instrument.id)}
                  className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="h-4 w-4" />
                    {t("parent.content.history")}
                  </span>
                  {isHistoryOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {isHistoryOpen && (
                  <div className="mt-2 space-y-2">
                    {isHistoryLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : history.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        {t("parent.content.noHistory")}
                      </p>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {item.title}
                              </span>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  item.content_type === "lesson"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {item.content_type === "lesson" ? "Les" : "Uitdaging"}
                              </span>
                              {item.is_repeat && (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  🔄
                                </span>
                              )}
                            </div>
                            {item.start_date && item.end_date && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatDate(item.start_date)} – {formatDate(item.end_date)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReuse(item.id, instrument.id)}
                            disabled={isPending}
                            title={t("parent.content.reuseAsChallenge")}
                            className="ml-2 shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
