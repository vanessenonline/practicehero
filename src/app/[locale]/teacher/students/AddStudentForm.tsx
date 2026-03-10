"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Copy } from "lucide-react";
import { addStudent } from "@/lib/actions/teacher";
import type { Instrument, Course } from "@/types/database";

interface AddStudentFormProps {
  instruments: Instrument[];
  courses: Course[];
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
 * Client form component for adding a new student to a teacher's studio.
 * Collects student info, instruments, and course assignment.
 * Displays generated student code on success.
 */
export function AddStudentForm({
  instruments,
  courses,
  locale,
}: AddStudentFormProps) {
  const t = useTranslations();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>(
    []
  );
  const [courseId, setCourseId] = useState<string>("none");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [targetEndDate, setTargetEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [studentCode, setStudentCode] = useState<string | null>(null);

  function toggleInstrument(id: string) {
    setSelectedInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handlePinChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
  }

  function handleConfirmPinChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setConfirmPin(digits);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate
    if (displayName.trim().length < 2) {
      setError("Naam moet minimaal 2 tekens zijn");
      return;
    }
    if (pin.length !== 4) {
      setError("PIN moet precies 4 cijfers zijn");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs komen niet overeen");
      return;
    }
    if (selectedInstrumentIds.length === 0) {
      setError("Selecteer minimaal één instrument");
      return;
    }

    setLoading(true);

    const result = await addStudent(
      displayName.trim(),
      pin,
      selectedInstrumentIds,
      courseId && courseId !== "none" ? courseId : null,
      startDate,
      targetEndDate || null
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setStudentCode(result.studentCode || null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (success && studentCode) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <p className="text-xl font-bold text-green-700">
            Leerling toegevoegd!
          </p>
          <div className="mt-4 w-full space-y-3">
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-700 font-medium mb-2">
                Geef deze code aan de leerling:
              </p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-2xl font-bold tracking-wider font-mono text-green-900">
                  {studentCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(studentCode)}
                  className="border-green-300 hover:bg-green-100"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Samen met je leraarcode (T-XXXX) kan de leerling inloggen
            </p>
          </div>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              router.push(`/${locale}/teacher/students`);
              router.refresh();
            }}
          >
            Terug naar leerlingen
          </Button>
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
        <Label htmlFor="displayName">Naam leerling</Label>
        <Input
          id="displayName"
          placeholder="bijv. Luuk"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoFocus
        />
      </div>

      {/* PIN */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            placeholder="4 cijfers"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            maxLength={4}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPin">PIN herhalen</Label>
          <Input
            id="confirmPin"
            type="password"
            inputMode="numeric"
            placeholder="4 cijfers"
            value={confirmPin}
            onChange={(e) => handleConfirmPinChange(e.target.value)}
            maxLength={4}
            required
          />
        </div>
      </div>

      {/* Instruments */}
      <div className="space-y-3">
        <Label>Instrumenten</Label>
        <div className="grid grid-cols-2 gap-2">
          {instruments.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => toggleInstrument(inst.id)}
              className={`rounded-lg border-2 p-3 text-center transition-colors ${
                selectedInstrumentIds.includes(inst.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-muted hover:border-blue-300"
              }`}
            >
              <div className="text-2xl">{INSTRUMENT_ICONS[inst.name_key] ?? "🎵"}</div>
              <div className="mt-1 text-sm font-medium">
                {inst.name_key}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Course (optional) */}
      {courses.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="course">Cursus (optioneel)</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger id="course">
              <SelectValue placeholder="Geen cursus geselecteerd" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Startdatum</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Einddatum (optioneel)</Label>
          <Input
            id="endDate"
            type="date"
            value={targetEndDate}
            onChange={(e) => setTargetEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={loading}
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Leerling toevoegen...
          </>
        ) : (
          "Leerling toevoegen"
        )}
      </Button>
    </form>
  );
}
