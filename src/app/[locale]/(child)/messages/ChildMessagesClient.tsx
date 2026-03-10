"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Heart,
  Send,
  Loader2,
  Lock,
  GraduationCap,
} from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";
import { sendStudioMessage } from "@/lib/actions/studio-messages";
import type { StudioMessage } from "@/types/database";

interface FamilyMessage {
  id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_id: string;
  recipient_id: string;
}

interface ChildMessagesClientProps {
  messages: FamilyMessage[];
  childId: string;
  parentId: string | null;
  canSend: boolean;
  /** When true, shows teacher conversation instead of parent conversation */
  teacherMode?: boolean;
  /** Display name of the teacher (for teacher mode) */
  teacherName?: string;
  /** Teacher user ID (for teacher mode sends) */
  teacherId?: string;
  /** Studio messages to display in teacher mode */
  studioMessages?: StudioMessage[];
}

/**
 * Client component for child messages.
 * Supports two modes:
 * - Default: family messaging with parent (family children)
 * - teacherMode: studio messaging with teacher (teacher-students)
 */
export function ChildMessagesClient({
  messages: initialFamilyMessages,
  childId,
  parentId,
  canSend,
  teacherMode = false,
  teacherName = "Leraar",
  teacherId,
  studioMessages: initialStudioMessages = [],
}: ChildMessagesClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Family mode state
  const [familyMessages, setFamilyMessages] = useState(initialFamilyMessages);
  // Teacher mode state
  const [studioMessages, setStudioMessages] = useState(initialStudioMessages);

  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Unified message list for rendering
  const displayMessages = teacherMode ? studioMessages : familyMessages;

  // Scroll to bottom on load and when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages]);

  function handleSend() {
    if (!newMessage.trim() || isPending) return;
    if (!teacherMode && !parentId) return;
    if (teacherMode && !teacherId) return;

    setError(null);
    const content = newMessage.trim();
    setNewMessage("");

    startTransition(async () => {
      let result: { success?: boolean; error?: string };

      if (teacherMode && teacherId) {
        result = await sendStudioMessage(teacherId, content);
      } else if (parentId) {
        result = await sendMessage(parentId, content);
      } else {
        return;
      }

      if (result.error) {
        setError(result.error);
        setNewMessage(content); // Restore on error
      } else {
        // Optimistic update
        const optimisticBase = {
          id: `temp-${Date.now()}`,
          content,
          is_read: false,
          created_at: new Date().toISOString(),
          sender_id: childId,
          recipient_id: teacherMode ? (teacherId ?? "") : (parentId ?? ""),
        };

        if (teacherMode) {
          setStudioMessages((prev) => [
            ...prev,
            { ...optimisticBase, studio_id: "" },
          ]);
        } else {
          setFamilyMessages((prev) => [...prev, optimisticBase]);
        }

        router.refresh();
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function relativeTime(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Zojuist";
    if (diffMin < 60)
      return `${diffMin} ${diffMin === 1 ? "minuut" : "minuten"} geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    if (diffDays === 1) return "Gisteren";
    if (diffDays < 7) return `${diffDays} dagen geleden`;
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
    });
  }

  // Determine if sending is possible
  const canActuallySend = canSend && (teacherMode ? !!teacherId : !!parentId);

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="py-2 text-center">
        <h1 className="text-2xl font-bold">{t("messages.title")}</h1>
        {displayMessages.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {teacherMode
              ? `Chat met ${teacherName}`
              : canSend
                ? "Chat met je ouder"
                : "Berichten van je ouder"}
          </p>
        )}
      </div>

      {/* Empty state */}
      {displayMessages.length === 0 ? (
        <div className="flex-1 py-12 text-center text-muted-foreground">
          <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>{t("messages.noMessages")}</p>
          <p className="mt-1 text-xs">
            {teacherMode
              ? canSend
                ? `Stuur ${teacherName} een bericht!`
                : `${teacherName} kan je hier berichten sturen!`
              : canSend
                ? "Stuur je ouder een bericht!"
                : "Je ouder kan je hier berichten sturen!"}
          </p>
        </div>
      ) : (
        /* Message thread */
        <div
          ref={scrollRef}
          className="flex-1 space-y-2 overflow-y-auto"
          style={{
            maxHeight: canActuallySend
              ? "calc(100vh - 320px)"
              : "calc(100vh - 240px)",
          }}
        >
          {displayMessages.map((message) => {
            const isFromChild = message.sender_id === childId;

            // Icon for received messages differs per mode
            const ReceivedIcon = teacherMode ? GraduationCap : Heart;
            const receivedIconClass = teacherMode
              ? "bg-blue-100 text-blue-600"
              : "bg-pink-100 text-pink-500";

            return isFromChild ? (
              /* Child's sent message – right aligned */
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-orange-500 px-4 py-2.5 text-white">
                  <p className="text-sm">{message.content}</p>
                  <p className="mt-1 text-[10px] text-orange-200">
                    {relativeTime(message.created_at)}
                  </p>
                </div>
              </div>
            ) : (
              /* Parent's / teacher's received message – left aligned */
              <div key={message.id} className="flex gap-2">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${receivedIconClass}`}
                >
                  <ReceivedIcon className="h-4 w-4" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                  <p className="text-sm">{message.content}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {relativeTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose area (if sending is enabled) */}
      {canActuallySend ? (
        <div className="space-y-2 border-t pt-3">
          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("messages.placeholder")}
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ maxHeight: "100px" }}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || isPending}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-orange-500 hover:bg-orange-600"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : !canSend ? (
        <div className="flex items-center justify-center gap-2 border-t pt-3 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          {t("messages.sendingDisabled")}
        </div>
      ) : null}
    </div>
  );
}
