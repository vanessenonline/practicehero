"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createCourse } from "@/lib/actions/teacher";
import type { Instrument } from "@/types/database";

interface AddCourseFormProps {
  instruments: Instrument[];
  locale: string;
}

const INSTRUMENT_ICONS: Record<string, string> = {
  piano: "🎹",
  drums: "🥁",
  guitar: "🎸",
  keyboard: "🎹",
  violin: "🎻",
  trumpet: "🎺",
};

/**
 * Client form component for adding a new course.
 * Collects course name, instrument, total lessons/levels, and description.
 */
export function AddCourseForm({ instruments, locale }: AddCourseFormProps) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [totalLessons, setTotalLessons] = useState("10");
  const [totalLevels, setTotalLevels] = useState("10");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [courseName, setCourseName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate
    if (name.trim().length < 2) {
      setError("Naam moet minimaal 2 tekens zijn");
      return;
    }
    if (!instrumentId) {
      setError("Selecteer een instrument");
      return;
    }
    if (!totalLessons || parseInt(totalLessons) < 1) {
      setError("Aantal lessen moet minstens 1 zijn");
      return;
    }
    if (!totalLevels || parseInt(totalLevels) < 1) {
      setError("Aantal niveaus moet minstens 1 zijn");
      return;
    }

    setLoading(true);

    const result = await createCourse(
      name.trim(),
      instrumentId,
      parseInt(totalLessons),
      parseInt(totalLevels),
      description.trim() || undefined
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setCourseName(name);

    // Wait a moment to show success, then navigate
    setTimeout(() => {
      router.push(`/${locale}/teacher/courses`);
      router.refresh();
    }, 1500);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <p className="text-xl font-bold text-green-700">
            Gelijkreeks aangemaakt!
          </p>
          <p className="text-sm text-muted-foreground">{courseName}</p>
          <p className="text-sm text-muted-foreground">
            Je kunt nu lessen toevoegen
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Naam gelijkreeks</Label>
        <Input
          id="name"
          placeholder="bijv. Klassieke piano niveau 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      {/* Instrument */}
      <div className="space-y-1.5">
        <Label htmlFor="instrument">Instrument</Label>
        <Select value={instrumentId} onValueChange={setInstrumentId}>
          <SelectTrigger id="instrument">
            <SelectValue placeholder="Selecteer een instrument" />
          </SelectTrigger>
          <SelectContent>
            {instruments.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                {INSTRUMENT_ICONS[inst.name_key] ?? "🎵"} {inst.name_key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lessons & Levels */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lessons">Aantal lessen</Label>
          <Input
            id="lessons"
            type="number"
            min="1"
            max="100"
            value={totalLessons}
            onChange={(e) => setTotalLessons(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">1-100</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="levels">Aantal niveaus</Label>
          <Input
            id="levels"
            type="number"
            min="1"
            max="100"
            value={totalLevels}
            onChange={(e) => setTotalLevels(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">1-100</p>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Beschrijving (optioneel)</Label>
        <Textarea
          id="description"
          placeholder="Beschrijf de inhoud van deze gelijkreeks..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={loading} size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gelijkreeks aanmaken...
          </>
        ) : (
          "Gelijkreeks aanmaken"
        )}
      </Button>
    </form>
  );
}
