"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateStudentCanSendMessages } from "@/lib/actions/teacher";

interface StudentMessagingToggleProps {
  studentId: string;
  initialCanSend: boolean;
}

/**
 * Client component for toggling a student's can_send_messages permission.
 * Uses the same custom CSS toggle pattern as ChildSettingsCard.
 * Calls the updateStudentCanSendMessages server action on toggle.
 */
export function StudentMessagingToggle({
  studentId,
  initialCanSend,
}: StudentMessagingToggleProps) {
  const t = useTranslations();
  const [canSend, setCanSend] = useState(initialCanSend);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const newValue = !canSend;
    setCanSend(newValue);
    setError(null);

    startTransition(async () => {
      const result = await updateStudentCanSendMessages(studentId, newValue);
      if (result.error) {
        // Revert on failure
        setCanSend(!newValue);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="flex w-full items-center justify-between rounded-lg py-1 text-left disabled:opacity-50"
      >
        <div>
          <p className="text-sm font-medium">
            {t("teacher.students.messaging")}
          </p>
          <p className="text-xs text-muted-foreground">
            {canSend
              ? t("teacher.students.messagingEnabled")
              : t("teacher.students.messagingDisabled")}
          </p>
        </div>
        <div
          className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
            canSend ? "bg-blue-500" : "bg-muted"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              canSend ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </button>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
