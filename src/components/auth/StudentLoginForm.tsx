"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginStudent } from "@/lib/actions/auth";

/**
 * Student login form for teacher's students.
 * Requires: teacher code (T-XXXX), student code (S-XXXX), and 4-digit PIN.
 */
export function StudentLoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();

  const [teacherCode, setTeacherCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleTeacherCodeChange(value: string) {
    // Accept T-XXXX format or just letters
    const formatted = value.toUpperCase().slice(0, 6);
    setTeacherCode(formatted);
  }

  function handleStudentCodeChange(value: string) {
    // Accept S-XXXX format or just letters
    const formatted = value.toUpperCase().slice(0, 6);
    setStudentCode(formatted);
  }

  function handlePinChange(value: string) {
    // Only allow digits, max 4 characters
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate
    if (!teacherCode.trim()) {
      setError("Voer leeraarcode in");
      return;
    }
    if (!studentCode.trim()) {
      setError("Voer leerlingcode in");
      return;
    }
    if (pin.length !== 4) {
      setError("PIN moet 4 cijfers zijn");
      return;
    }

    setLoading(true);

    const result = await loginStudent(teacherCode.trim(), studentCode.trim(), pin);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Success - middleware will redirect
    router.push(`/${locale}/home`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Teacher Code */}
      <div className="space-y-2">
        <Label htmlFor="teacherCode">Leeraarcode</Label>
        <Input
          id="teacherCode"
          placeholder="T-XXXX"
          value={teacherCode}
          onChange={(e) => handleTeacherCodeChange(e.target.value)}
          maxLength={6}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          bijv. T-A1B2
        </p>
      </div>

      {/* Student Code */}
      <div className="space-y-2">
        <Label htmlFor="studentCode">Leerlingcode</Label>
        <Input
          id="studentCode"
          placeholder="S-XXXX"
          value={studentCode}
          onChange={(e) => handleStudentCodeChange(e.target.value)}
          maxLength={6}
          required
        />
        <p className="text-xs text-muted-foreground">
          bijv. S-C3D4
        </p>
      </div>

      {/* PIN */}
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          placeholder="0000"
          value={pin}
          onChange={(e) => handlePinChange(e.target.value)}
          maxLength={4}
          required
        />
        <p className="text-xs text-muted-foreground">
          4 cijfers
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {loading ? "Inloggen..." : "Inloggen"}
      </Button>
    </form>
  );
}
