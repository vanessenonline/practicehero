"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  Mic,
  MicOff,
  Sparkles,
  Flame,
  Star,
  CheckCircle2,
  Clock,
  Home,
  RotateCcw,
  Video,
  Music,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { startPracticeSession, completePracticeSession } from "@/lib/actions/practice";
import type { Instrument, PracticeContent } from "@/types/database";
import type { AudioClassification } from "@/types";
import { formatTime } from "@/lib/utils/date";
import {
  createAudioAnalyzer,
  classifyFrame,
  createClassifierState,
} from "@/lib/audio";
import type { AudioAnalyzerHandle, ClassifierState } from "@/lib/audio";

const PRACTICE_GOAL_SECONDS = 15 * 60; // 15 minutes

// ---------------------------------------------------------------------------
// YouTube / Spotify helpers
// ---------------------------------------------------------------------------

/**
 * Extract a YouTube video ID from various URL formats.
 * Supports youtube.com/watch?v=, youtu.be/, youtube.com/embed/.
 */
function extractYouTubeId(url: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const vParam = parsed.searchParams.get("v");
      if (vParam) return vParam;
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    // Invalid URL — ignore
  }
  return null;
}

/**
 * Extract a Spotify resource path (track/album/playlist ID) from a URL.
 * Returns the embed path segment like "track/4iV5W9uYEdYUVa79Axb7Rh".
 */
function extractSpotifyPath(url: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("spotify.com")) return null;
    // Path like /track/4iV5W9..., /album/..., /playlist/...
    const match = parsed.pathname.match(
      /\/(track|album|playlist)\/([a-zA-Z0-9]+)/
    );
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // Invalid URL — ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components for content cards with media embeds
// ---------------------------------------------------------------------------

/**
 * Lesson card with optional collapsible YouTube video embed.
 */
function LessonCard({
  lesson,
  t,
}: {
  lesson: PracticeContent;
  t: ReturnType<typeof useTranslations>;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const youtubeId = extractYouTubeId(lesson.video_url);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">
          📖 {t("practice.currentLesson")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{lesson.title}</p>
        {lesson.description && (
          <p className="text-sm text-muted-foreground">
            {lesson.description}
          </p>
        )}

        {/* Repeat badge */}
        {lesson.is_repeat && (
          <Badge variant="secondary" className="text-xs">
            🔄 {t("practice.repeatChallenge")}
          </Badge>
        )}

        {/* Bonus points badge */}
        {lesson.bonus_points > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs bg-amber-100 text-amber-700">
            +{lesson.bonus_points} {t("practice.bonusAvailable")}
          </Badge>
        )}

        {/* YouTube video toggle */}
        {youtubeId && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setVideoOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              <Video className="h-4 w-4" />
              {t("practice.watchVideo")}
              {videoOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {videoOpen && (
              <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Motivator/challenge card with optional compact Spotify embed.
 */
function MotivatorCard({
  motivator,
  t,
}: {
  motivator: PracticeContent;
  t: ReturnType<typeof useTranslations>;
}) {
  const spotifyPath = extractSpotifyPath(motivator.audio_url);
  const isPlaylist = spotifyPath?.startsWith("playlist");

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm text-purple-600">
          <Sparkles className="h-4 w-4" />
          {t("practice.newChallenge")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{motivator.title}</p>
        {motivator.description && (
          <p className="text-sm text-muted-foreground">
            {motivator.description}
          </p>
        )}

        {/* Repeat badge */}
        {motivator.is_repeat && (
          <Badge variant="secondary" className="text-xs">
            🔄 {t("practice.repeatChallenge")}
          </Badge>
        )}

        {/* Bonus points badge */}
        {motivator.bonus_points > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs bg-amber-100 text-amber-700">
            +{motivator.bonus_points} {t("practice.bonusAvailable")}
          </Badge>
        )}

        {/* Spotify embed */}
        {spotifyPath && (
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 mb-2">
              <Music className="h-4 w-4" />
              {t("practice.listenTrack")}
            </div>
            <div
              className="overflow-hidden rounded-lg"
              style={{ height: isPlaylist ? 352 : 80 }}
            >
              <iframe
                src={`https://open.spotify.com/embed/${spotifyPath}?theme=0`}
                title="Spotify player"
                allow="encrypted-media"
                className="h-full w-full"
                style={{ border: "none" }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PracticeSessionProps {
  instrument: Instrument;
  locale: string;
  childName: string;
  lesson: PracticeContent | null;
  motivator: PracticeContent | null;
}

type Phase = "idle" | "running" | "paused" | "summary";

/**
 * Client component for the active practice session.
 * Manages the timer, calls start/complete server actions,
 * and shows a summary screen when done.
 */
export function PracticeSession({
  instrument,
  locale,
  childName,
  lesson,
  motivator,
}: PracticeSessionProps) {
  const t = useTranslations();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  // Seconds already practiced in earlier attempts today (carries over on "Nog een keer")
  const [cumulativePriorSeconds, setCumulativePriorSeconds] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Summary data
  const [summaryData, setSummaryData] = useState<{
    bonusPoints: number;
    newStreakCount: number;
    streakMilestone: boolean;
    totalPoints: number;
    superCreditsEarned: number;
  } | null>(null);

  // Audio detection state (Tier 2: instrument classification)
  const [audioClassification, setAudioClassification] = useState<AudioClassification>({
    instrument: "silence",
    confidence: 0,
    isActive: false,
  });
  const [audioDetected, setAudioDetected] = useState(false);
  const [micPermission, setMicPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const analyzerHandleRef = useRef<AudioAnalyzerHandle | null>(null);
  const classifierStateRef = useRef<ClassifierState>(createClassifierState());
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Track cumulative confidence across the session for the final score */
  const confidenceSamplesRef = useRef<number[]>([]);

  // effectiveElapsed = cumulative prior time + current session time.
  // All goal/bonus logic is based on the TOTAL practiced today, so that
  // "Nog een keer" picks up exactly where the child left off.
  const effectiveElapsed = cumulativePriorSeconds + elapsed;
  const remaining = Math.max(0, PRACTICE_GOAL_SECONDS - effectiveElapsed);
  const isGoalReached = effectiveElapsed >= PRACTICE_GOAL_SECONDS;
  // Bonus seconds = how far above the daily 15-min goal we are right now
  const bonusSeconds = isGoalReached ? effectiveElapsed - PRACTICE_GOAL_SECONDS : 0;
  const previewBonusPoints = Math.floor(bonusSeconds / 300);

  // Motivating message that evolves as the child practices (based on total today)
  const getMotivationMsg = (): string => {
    if (remaining <= 60) return "💪 Laatste minuut! Jij kan dit!";
    if (remaining <= 3 * 60) return `🔥 Bijna! Nog maar ${Math.ceil(remaining / 60)} minuten!`;
    if (effectiveElapsed >= 10 * 60) return "⭐ Super goed bezig! Houd vol!";
    if (effectiveElapsed >= 5 * 60) return "🎵 Geweldig! Blijf lekker spelen!";
    if (effectiveElapsed >= 2 * 60) return "🎶 Goed bezig! Ga zo door!";
    return "🎶 Lekker aan het oefenen!";
  };

  // Instrument display
  const instColors: Record<string, string> = {
    piano: "from-blue-500 to-blue-600",
    drums: "from-red-500 to-red-600",
    guitar: "from-green-500 to-green-600",
  };
  const gradientClass =
    instColors[instrument.name_key] ?? "from-orange-500 to-orange-600";

  // -------------------------------------------------------------------------
  // Timer tick
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // -------------------------------------------------------------------------
  // Audio detection (Tier 2: instrument classification)
  // -------------------------------------------------------------------------
  const startAudioDetection = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");

      const handle = createAudioAnalyzer(stream);
      analyzerHandleRef.current = handle;
      classifierStateRef.current = createClassifierState();
      confidenceSamplesRef.current = [];

      // Sample audio every 500ms for classification
      audioIntervalRef.current = setInterval(() => {
        const energies = handle.getBandEnergies();
        const result = classifyFrame(
          classifierStateRef.current,
          energies,
          instrument.name_key,
          instrument.detection_profile
        );

        setAudioClassification(result);
        setAudioDetected(result.isActive);

        // Track confidence for session average
        if (result.isActive) {
          confidenceSamplesRef.current.push(result.confidence);
        }
      }, 500);
    } catch {
      setMicPermission("denied");
    }
  }, [instrument.name_key, instrument.detection_profile]);

  const stopAudioDetection = useCallback(() => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    if (analyzerHandleRef.current) {
      analyzerHandleRef.current.destroy();
      analyzerHandleRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudioDetection();
  }, [stopAudioDetection]);

  // -------------------------------------------------------------------------
  // Session controls
  // -------------------------------------------------------------------------
  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setStartError(null);

    const result = await startPracticeSession(instrument.id);

    if (result.error || !result.sessionId) {
      setStartError(result.error ?? "Kon sessie niet starten.");
      setIsStarting(false);
      return;
    }

    setSessionId(result.sessionId);
    setPhase("running");
    setIsStarting(false);
    await startAudioDetection();
  }, [instrument.id, startAudioDetection]);

  const handlePause = useCallback(() => {
    setPhase((p) => (p === "running" ? "paused" : "running"));
  }, []);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;

    stopAudioDetection();
    setPhase("summary");

    // Calculate average audio confidence across the session
    const samples = confidenceSamplesRef.current;
    const avgConfidence = samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : null;

    const result = await completePracticeSession(
      sessionId,
      elapsed,              // this session's duration
      cumulativePriorSeconds, // prior accumulated time today (for correct bonus/streak calc)
      audioDetected,
      avgConfidence
    );

    if (result.error) {
      // Still show summary but with 0 values
      setSummaryData({
        bonusPoints: 0,
        newStreakCount: 0,
        streakMilestone: false,
        totalPoints: 0,
        superCreditsEarned: 0,
      });
    } else {
      setSummaryData(result);
    }
  }, [sessionId, elapsed, cumulativePriorSeconds, audioDetected, stopAudioDetection]);

  // -------------------------------------------------------------------------
  // Circular timer SVG helpers
  // -------------------------------------------------------------------------
  const RADIUS = 90;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  // Progress is based on total time practiced today (cumulative + current)
  const progress = Math.min(1, effectiveElapsed / PRACTICE_GOAL_SECONDS);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // -------------------------------------------------------------------------
  // Summary screen
  // -------------------------------------------------------------------------
  if (phase === "summary") {
    // Use total practiced today (cumulative + this session) for all summary display
    const totalPracticedSeconds = cumulativePriorSeconds + elapsed;
    const durationMinutes = Math.floor(totalPracticedSeconds / 60);
    const remainingMinutes = Math.ceil(Math.max(0, PRACTICE_GOAL_SECONDS - totalPracticedSeconds) / 60);
    const goalReached = totalPracticedSeconds >= PRACTICE_GOAL_SECONDS;

    return (
      <div className="space-y-4">
        <div className="py-4 text-center">
          {goalReached ? (
            <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-green-500" />
          ) : (
            <Clock className="mx-auto mb-3 h-16 w-16 text-orange-400" />
          )}
          <h1 className="text-2xl font-bold">
            {goalReached
              ? t("practice.session.complete", { name: childName })
              : "Goed geprobeerd! 👍"}
          </h1>
          <p className="text-muted-foreground">
            {durationMinutes} {t("common.minutes")} geoefend
          </p>
        </div>

        {summaryData ? (
          goalReached ? (
            // ✅ Goal reached: show streak + points earned
            <div className="grid grid-cols-2 gap-3">
              {/* Streak */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="flex flex-col items-center p-4">
                  <Flame className="mb-1 h-8 w-8 text-orange-500" />
                  <p className="text-2xl font-bold text-orange-600">
                    {summaryData.newStreakCount}
                  </p>
                  <p className="text-xs text-orange-600/70">
                    {t("streak.current", { count: summaryData.newStreakCount })}
                  </p>
                  {summaryData.streakMilestone && (
                    <Badge className="mt-1 bg-orange-500 text-[10px]">
                      🏆 Mijlpaal!
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Points */}
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="flex flex-col items-center p-4">
                  <Star className="mb-1 h-8 w-8 text-yellow-500" />
                  {summaryData.bonusPoints > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-yellow-600">
                        +{summaryData.bonusPoints}
                      </p>
                      <p className="text-xs text-yellow-600/70">
                        {t("practice.session.pointsEarned", {
                          points: summaryData.bonusPoints,
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-yellow-600">
                        {summaryData.totalPoints}
                      </p>
                      <p className="text-xs text-yellow-600/70">
                        totaal {t("common.points")}
                      </p>
                    </>
                  )}
                  {summaryData.superCreditsEarned > 0 && (
                    <Badge className="mt-1 bg-purple-500 text-[10px]">
                      +{summaryData.superCreditsEarned} SC
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            // ⏰ Stopped early: motivating "try again" card
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
              <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-4xl">⏰</p>
                <div>
                  <p className="font-semibold text-orange-700">
                    Je hebt {durationMinutes} {durationMinutes === 1 ? "minuut" : "minuten"} gespeeld vandaag!
                  </p>
                  <p className="mt-1 text-sm text-orange-600">
                    Oefen <strong>15 minuten</strong> om je streak te verdienen 🔥
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Nog</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-700">
                    {remainingMinutes} min
                  </span>
                  <span>te gaan — dat kan jij!</span>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Bezig met opslaan...
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1" size="lg">
            <Link href={`/${locale}/home`}>
              <Home className="mr-2 h-4 w-4" />
              Naar huis
            </Link>
          </Button>
          <Button
            variant="default"
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            size="lg"
            onClick={() => {
              const currentEffective = cumulativePriorSeconds + elapsed;
              const remainingSecs = Math.max(0, PRACTICE_GOAL_SECONDS - currentEffective);

              let newCumulative: number;
              if (remainingSecs > 0) {
                // Round remaining UP to whole minutes (e.g. 12:33 left → 13:00 on restart).
                // cumulativePriorSeconds is set so the timer starts at that clean boundary.
                const roundedRemaining = Math.ceil(remainingSecs / 60) * 60;
                newCumulative = Math.max(0, PRACTICE_GOAL_SECONDS - roundedRemaining);
              } else {
                // Goal already reached: carry over exact effective time so bonus
                // keeps accumulating from exactly where the child left off.
                newCumulative = currentEffective;
              }

              setCumulativePriorSeconds(newCumulative);
              setPhase("idle");
              setElapsed(0);
              setSessionId(null);
              setSummaryData(null);
              setAudioDetected(false);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Nog een keer
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Active timer screen
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Instrument badge */}
      <div className="py-2 text-center">
        <Badge
          className={`bg-gradient-to-r ${gradientClass} px-3 py-1 text-sm text-white`}
        >
          {instrument.name_key === "piano" && "🎹"}
          {instrument.name_key === "drums" && "🥁"}
          {instrument.name_key === "guitar" && "🎸"}
          {!["piano", "drums", "guitar"].includes(instrument.name_key) && "🎵"}{" "}
          {t(
            `instruments.${instrument.name_key}` as Parameters<typeof t>[0]
          )}
        </Badge>
      </div>

      {/* Timer card */}
      <Card
        className={`overflow-hidden ${isGoalReached ? "border-green-300 bg-green-50" : ""}`}
      >
        <CardContent className="flex flex-col items-center py-8">
          {/* SVG circular timer */}
          <div className="relative flex h-52 w-52 items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 200 200">
              {/* Background ring */}
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted"
              />
              {/* Progress ring */}
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className={isGoalReached ? "text-green-500" : "text-orange-500"}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
            </svg>

            <div className="z-10 text-center">
              {isGoalReached ? (
                <>
                  <p className="text-sm font-medium text-green-600">BONUS</p>
                  <p className="text-4xl font-bold tabular-nums text-green-600">
                    +{formatTime(bonusSeconds)}
                  </p>
                  {previewBonusPoints > 0 && (
                    <p className="text-xs text-green-600/70">
                      +{previewBonusPoints} {t("common.points")}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold tabular-nums">
                    {formatTime(remaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {phase === "paused" ? "⏸ Gepauzeerd" : "over"}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Audio indicator with instrument classification */}
          {phase !== "idle" && (
            <div className="mt-3 flex items-center gap-2 rounded-full bg-muted px-4 py-1.5">
              {micPermission === "denied" ? (
                <>
                  <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Geen microfoon toegang
                  </span>
                </>
              ) : audioClassification.isActive ? (
                <>
                  <Mic className="h-3.5 w-3.5 animate-pulse text-green-500" />
                  <span className="text-xs text-green-600">
                    {audioClassification.instrument !== "unknown"
                      ? t("practice.audio.detected", {
                          instrument: t(
                            `instruments.${audioClassification.instrument}` as Parameters<
                              typeof t
                            >[0]
                          ),
                        })
                      : t("practice.audio.detected", {
                          instrument: t(
                            `instruments.${instrument.name_key}` as Parameters<
                              typeof t
                            >[0]
                          ),
                        })}
                  </span>
                  {/* Confidence bar */}
                  <div className="ml-1 h-1.5 w-12 overflow-hidden rounded-full bg-green-200">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.round(audioClassification.confidence * 100)}%` }}
                    />
                  </div>
                </>
              ) : audioClassification.instrument === "silence" ? (
                <>
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("practice.audio.waiting")}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("practice.audio.waiting")}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {startError && (
            <p className="mt-2 text-sm text-destructive">{startError}</p>
          )}

          {/* Controls */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {phase === "idle" ? (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={isStarting}
                className="h-14 w-44 bg-gradient-to-r from-orange-500 to-orange-600 text-lg hover:from-orange-600 hover:to-orange-700"
              >
                <Play className="mr-2 h-5 w-5" />
                {isStarting ? "Even wachten..." : t("common.start")}
              </Button>
            ) : isGoalReached ? (
              // ✅ Goal reached: big celebratory Finish button
              <Button
                size="lg"
                onClick={handleStop}
                className="h-14 w-52 animate-bounce bg-green-600 text-lg font-bold hover:bg-green-700"
              >
                🎉 Klaar! Super gedaan!
              </Button>
            ) : (
              // ⏱ Still counting down: pause + motivation
              <>
                {/* Motivating message */}
                <p className="text-sm font-semibold text-orange-500">
                  {getMotivationMsg()}
                </p>

                {/* Pause button */}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handlePause}
                  className="h-12 w-12 p-0"
                >
                  {phase === "paused" ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                </Button>

                {/* Subtle early-stop option — only visible after 30s */}
                {elapsed >= 30 && (
                  <button
                    onClick={handleStop}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Toch stoppen
                  </button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current lesson with optional YouTube embed */}
      {lesson ? (
        <LessonCard lesson={lesson} t={t} />
      ) : null}

      {/* Motivator / challenge with optional Spotify embed */}
      {motivator ? (
        <MotivatorCard motivator={motivator} t={t} />
      ) : null}
    </div>
  );
}
