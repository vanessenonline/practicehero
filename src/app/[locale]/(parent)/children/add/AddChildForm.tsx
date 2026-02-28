"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { addChild } from "@/lib/actions/auth";
import type { Instrument } from "@/types/database";

interface AddChildFormProps {
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
 * Client form component for adding a new child.
 * Calls the addChild server action and redirects on success.
 */
export function AddChildForm({ instruments, locale }: AddChildFormProps) {
  const t = useTranslations();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleInstrument(id: string) {
    setSelectedInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handlePinChange(value: string) {
    // Only allow digits, max 4 characters
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

    const result = await addChild(
      displayName.trim(),
      pin,
      selectedInstrumentIds
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);

    // Wait a moment to show success, then navigate
    setTimeout(() => {
      router.push(`/${locale}/children`);
      router.refresh();
    }, 1500);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <p className="text-xl font-bold text-green-700">
            {t("parent.children.added")}
          </p>
          <p className="text-sm text-muted-foreground">
            {displayName} kan nu inloggen met de PIN
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="displayName">{t("parent.children.name")}</Label>
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
      <div className="space-y-1.5">
        <Label htmlFor="pin">{t("parent.children.pin")}</Label>
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
        <p className="text-xs text-muted-foreground">
          {t("parent.children.pinHelp")}
        </p>
      </div>

      {/* Confirm PIN */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPin">Bevestig PIN</Label>
        <Input
          id="confirmPin"
          type="password"
          inputMode="numeric"
          placeholder="Herhaal PIN"
          value={confirmPin}
          onChange={(e) => handleConfirmPinChange(e.target.value)}
          maxLength={4}
          required
        />
      </div>

      {/* Instrument selection */}
      <div className="space-y-2">
        <Label>{t("parent.children.selectInstruments")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {instruments.map((inst) => {
            const selected = selectedInstrumentIds.includes(inst.id);
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => toggleInstrument(inst.id)}
                className={`
                  flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all
                  ${
                    selected
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-border bg-white hover:border-orange-200 hover:bg-orange-50/50"
                  }
                `}
              >
                <span className="text-2xl">{INSTRUMENT_ICONS[inst.name_key] ?? "🎵"}</span>
                <span className="font-medium text-sm">
                  {t(`instruments.${inst.name_key}` as Parameters<typeof t>[0])}
                </span>
                {selected && (
                  <Badge className="ml-auto bg-orange-500 px-1.5 py-0.5 text-[10px]">✓</Badge>
                )}
              </button>
            );
          })}
        </div>
        {selectedInstrumentIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedInstrumentIds.length} instrument{selectedInstrumentIds.length !== 1 ? "en" : ""} geselecteerd
            {selectedInstrumentIds.length > 1 && " — eerste is het primaire instrument"}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
            {t("common.loading")}
          </>
        ) : (
          t("parent.children.add")
        )}
      </Button>
    </form>
  );
}
