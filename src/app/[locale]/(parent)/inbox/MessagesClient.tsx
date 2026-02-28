"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";

interface Child {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface MessagesClientProps {
  children: Child[];
  messages: Message[];
  parentId: string;
  familyId: string;
  preselectedChildId?: string;
  locale: string;
}

/**
 * Client component for the parent messages interface.
 * Allows selecting a child and sending motivational messages.
 */
export function MessagesClient({
  children,
  messages,
  parentId,
  preselectedChildId,
  locale,
}: MessagesClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedChildId, setSelectedChildId] = useState<string>(
    preselectedChildId ?? children[0]?.id ?? ""
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  // Filter messages for selected child (both directions)
  const conversation = messages.filter(
    (m) =>
      (m.sender_id === parentId && m.recipient_id === selectedChildId) ||
      (m.sender_id === selectedChildId && m.recipient_id === parentId)
  );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [text]);

  async function handleSend() {
    if (!text.trim() || !selectedChildId) return;
    setError(null);

    const content = text.trim();
    setText("");

    startTransition(async () => {
      const result = await sendMessage(selectedChildId, content);
      if (result.error) {
        setError(result.error);
        setText(content); // Restore text on error
      } else {
        router.refresh();
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (children.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent className="flex flex-col items-center gap-3">
          <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Voeg eerst een kind toe om berichten te sturen
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Child selector tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {children.map((child) => {
          const unread = messages.filter(
            (m) => m.sender_id === child.id && m.recipient_id === parentId && !m.is_read
          ).length;

          return (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`
                flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors
                ${
                  selectedChildId === child.id
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-border bg-white hover:border-orange-200"
                }
              `}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {child.display_name.charAt(0).toUpperCase()}
              </span>
              {child.display_name}
              {unread > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Message thread */}
      <Card>
        <CardContent className="p-0">
          {/* Messages area */}
          <div className="max-h-96 min-h-32 overflow-y-auto p-4 space-y-3">
            {conversation.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nog geen berichten met {selectedChild?.display_name}.<br />
                Stuur een motiverend bericht!
              </p>
            ) : (
              conversation.map((msg) => {
                const isFromParent = msg.sender_id === parentId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromParent ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`
                        max-w-[80%] rounded-2xl px-4 py-2 text-sm
                        ${isFromParent
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                        }
                      `}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isFromParent ? "text-orange-200" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Compose area */}
          <div className="flex items-end gap-2 p-3">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedChild
                  ? t("parent.messages.placeholder")
                  : "Selecteer een kind..."
              }
              disabled={!selectedChildId || isPending}
              className="min-h-[40px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!text.trim() || !selectedChildId || isPending}
              className="h-10 w-10 shrink-0 rounded-full p-0"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Druk Enter om te versturen, Shift+Enter voor nieuwe regel
      </p>
    </div>
  );
}
