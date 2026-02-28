"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Heart,
  Send,
  Loader2,
  Lock,
} from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";

interface Message {
  id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_id: string;
  recipient_id: string;
}

interface ChildMessagesClientProps {
  messages: Message[];
  childId: string;
  parentId: string | null;
  canSend: boolean;
}

/**
 * Client component for child messages with optional compose functionality.
 * Shows a chat-style thread and, if enabled, a compose area at the bottom.
 */
export function ChildMessagesClient({
  messages: initialMessages,
  childId,
  parentId,
  canSend,
}: ChildMessagesClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Scroll to bottom on load and when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!newMessage.trim() || !parentId || isPending) return;

    setError(null);

    startTransition(async () => {
      const result = await sendMessage(parentId, newMessage.trim());

      if (result.error) {
        setError(result.error);
      } else {
        // Optimistically add the message
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            content: newMessage.trim(),
            is_read: false,
            created_at: new Date().toISOString(),
            sender_id: childId,
            recipient_id: parentId,
          },
        ]);
        setNewMessage("");
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
      return `${diffMin} minuut${diffMin !== 1 ? "en" : ""} geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    if (diffDays === 1) return "Gisteren";
    if (diffDays < 7) return `${diffDays} dagen geleden`;
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
    });
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="py-2 text-center">
        <h1 className="text-2xl font-bold">{t("messages.title")}</h1>
        {messages.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {canSend ? "Chat met je ouder" : "Berichten van je ouder"}
          </p>
        )}
      </div>

      {/* Empty state */}
      {messages.length === 0 ? (
        <div className="flex-1 py-12 text-center text-muted-foreground">
          <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>{t("messages.noMessages")}</p>
          <p className="mt-1 text-xs">
            {canSend
              ? "Stuur je ouder een bericht!"
              : "Je ouder kan je hier berichten sturen!"}
          </p>
        </div>
      ) : (
        /* Message thread */
        <div
          ref={scrollRef}
          className="flex-1 space-y-2 overflow-y-auto"
          style={{ maxHeight: canSend ? "calc(100vh - 320px)" : "calc(100vh - 240px)" }}
        >
          {messages.map((message) => {
            const isFromChild = message.sender_id === childId;

            return isFromChild ? (
              /* Child's sent message - right aligned */
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-orange-500 px-4 py-2.5 text-white">
                  <p className="text-sm">{message.content}</p>
                  <p className="mt-1 text-[10px] text-orange-200">
                    {relativeTime(message.created_at)}
                  </p>
                </div>
              </div>
            ) : (
              /* Parent's received message - left aligned */
              <div key={message.id} className="flex gap-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-500">
                  <Heart className="h-4 w-4" />
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

      {/* Compose area (if enabled) */}
      {canSend && parentId ? (
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
