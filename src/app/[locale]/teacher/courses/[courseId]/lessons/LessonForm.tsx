"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { saveCourseLesson } from "@/lib/actions/teacher";
import type { CourseLesson } from "@/types/database";

interface LessonFormProps {
  courseId: string;
  lessonNumber: number;
  levelNumber: number;
  /** When provided the form operates in edit mode. */
  existingLesson?: CourseLesson;
}

export function LessonForm({
  courseId,
  lessonNumber,
  levelNumber,
  existingLesson,
}: LessonFormProps) {
  const router = useRouter();
  const locale = useLocale();

  const [title, setTitle] = useState(existingLesson?.title ?? "");
  const [description, setDescription] = useState(existingLesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(existingLesson?.video_url ?? "");
  const [audioUrl, setAudioUrl] = useState(existingLesson?.audio_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await saveCourseLesson(
      courseId,
      lessonNumber,
      levelNumber,
      title,
      description || null,
      videoUrl || null,
      audioUrl || null
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    setTimeout(() => {
      router.push(`/${locale}/teacher/courses/${courseId}/lessons`);
      router.refresh();
    }, 1000);
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <p className="text-xl font-bold text-green-700">Les opgeslagen!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Titel *</Label>
        <Input
          id="title"
          placeholder="bijv. Vingerplaatsing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Beschrijving (optioneel)</Label>
        <Textarea
          id="description"
          placeholder="Wat behandelt deze les?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="videoUrl">Video URL (optioneel)</Label>
        <Input
          id="videoUrl"
          type="url"
          placeholder="https://youtube.com/..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audioUrl">Audio URL (optioneel)</Label>
        <Input
          id="audioUrl"
          type="url"
          placeholder="https://..."
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading} size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {existingLesson ? "Opslaan..." : "Les aanmaken..."}
          </>
        ) : existingLesson ? (
          "Wijzigingen opslaan"
        ) : (
          "Les aanmaken"
        )}
      </Button>
    </form>
  );
}
