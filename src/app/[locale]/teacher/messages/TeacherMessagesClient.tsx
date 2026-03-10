"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Send,
  Loader2,
  Users,
  UserRound,
} from "lucide-react";
import {
  sendStudioMessage,
  getStudioMessagesForConversation,
  markStudioMessagesRead,
} from "@/lib/actions/studio-messages";
import type { StudioContact } from "@/lib/actions/studio-messages";
import type { StudioMessage } from "@/types/database";

interface TeacherMessagesClientProps {
  contacts: StudioContact[];
  studioId: string;
  teacherId: string;
  preselectedContactId?: string;
}

/**
 * Interactive teacher messaging interface.
 * Shows a contact list (students + linked parents) and a conversation thread.
 * Closely mirrors the parent MessagesClient pattern.
 */
export function TeacherMessagesClient({
  contacts,
  studioId,
  teacherId,
  preselectedContactId,
}: TeacherMessagesClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const students = contacts.filter((c) => c.contact_type === "student");
  const parents = contacts.filter((c) => c.contact_type === "parent");

  const firstContact =
    contacts.find((c) => c.id === preselectedContactId) ?? contacts[0];

  const [selectedContactId, setSelectedContactId] = useState<string>(
    firstContact?.id ?? ""
  );
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Load messages when selected contact changes
  useEffect(() => {
    if (!selectedContactId) return;

    setLoadingMessages(true);
    setMessages([]);

    getStudioMessagesForConversation(studioId, selectedContactId).then(
      (msgs) => {
        setMessages(msgs);
        setLoadingMessages(false);

        // Mark unread messages as read
        const unreadIds = msgs
          .filter((m) => m.recipient_id === teacherId && !m.is_read)
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          markStudioMessagesRead(unreadIds).then(() => router.refresh());
        }
      }
    );
  }, [selectedContactId, studioId, teacherId, router]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [text]);

  async function handleSend() {
    if (!text.trim() || !selectedContactId || isPending) return;
    setError(null);

    const content = text.trim();
    setText("");

    startTransition(async () => {
      const result = await sendStudioMessage(selectedContactId, content);
      if (result.error) {
        setError(result.error);
        setText(content);
      } else {
        // Optimistic update
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            studio_id: studioId,
            sender_id: teacherId,
            recipient_id: selectedContactId,
            content,
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ]);
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

  function relativeTime(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    if (diffMin < 1) return "Zojuist";
    if (diffMin < 60) return `${diffMin} min geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    });
  }

  // Empty state when no contacts at all
  if (contacts.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent className="flex flex-col items-center gap-3">
          <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {t("teacher.messages.noContacts")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* ── Contact list (left panel) ───────────────────────────────────── */}
      <div className="space-y-3">
        {/* Students */}
        {students.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t("teacher.messages.students")}
            </p>
            <div className="space-y-1">
              {students.map((contact) => (
                <ContactButton
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedContactId === contact.id}
                  onSelect={setSelectedContactId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Parents */}
        {parents.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              {t("teacher.messages.parents")}
            </p>
            <div className="space-y-1">
              {parents.map((contact) => (
                <ContactButton
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedContactId === contact.id}
                  onSelect={setSelectedContactId}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Conversation panel (right) ──────────────────────────────────── */}
      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col p-0">
          {/* Header */}
          {selectedContact && (
            <div className="border-b px-4 py-3">
              <p className="font-semibold">{selectedContact.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedContact.contact_type === "student"
                  ? "Leerling"
                  : "Ouder"}
              </p>
            </div>
          )}

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="min-h-40 flex-1 overflow-y-auto p-4 space-y-3"
            style={{ maxHeight: "400px" }}
          >
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("teacher.messages.noMessages")}
              </p>
            ) : (
              messages.map((msg) => {
                const isFromTeacher = msg.sender_id === teacherId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromTeacher ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        isFromTeacher
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={`mt-1 text-[10px] ${isFromTeacher ? "text-blue-200" : "text-muted-foreground"}`}
                      >
                        {relativeTime(msg.created_at)}
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
                selectedContact
                  ? t("teacher.messages.placeholder")
                  : "Selecteer een contact..."
              }
              disabled={!selectedContactId || isPending}
              className="min-h-[40px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!text.trim() || !selectedContactId || isPending}
              className="h-10 w-10 shrink-0 rounded-full bg-blue-600 p-0 hover:bg-blue-700"
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
        <div className="col-span-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

// ── Helper sub-component ────────────────────────────────────────────────────

interface ContactButtonProps {
  contact: StudioContact;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ContactButton({ contact, isSelected, onSelect }: ContactButtonProps) {
  return (
    <button
      onClick={() => onSelect(contact.id)}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isSelected
          ? "bg-blue-100 text-blue-900"
          : "text-muted-foreground hover:bg-blue-50 hover:text-blue-900"
      }`}
    >
      {/* Avatar / initials */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
        {contact.display_name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 truncate text-left">{contact.display_name}</span>
      {contact.unread_count > 0 && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          {contact.unread_count}
        </span>
      )}
    </button>
  );
}
