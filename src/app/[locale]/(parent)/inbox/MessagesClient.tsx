"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle, GraduationCap, Plus } from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";
import {
  sendStudioMessage,
  getStudioMessagesForConversation,
  linkParentToStudio,
} from "@/lib/actions/studio-messages";
import type { LinkedStudio } from "@/lib/actions/studio-messages";
import type { StudioMessage } from "@/types/database";

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
  linkedStudios: LinkedStudio[];
}

type ActiveTab = "children" | "teachers";

/**
 * Client component for the parent messages interface.
 * Two tabs: "Kinderen" (family messaging) and "Leraren" (studio messaging).
 */
export function MessagesClient({
  children,
  messages,
  parentId,
  preselectedChildId,
  linkedStudios,
}: MessagesClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("children");

  // ── Children tab state ─────────────────────────────────────────────────
  const [selectedChildId, setSelectedChildId] = useState<string>(
    preselectedChildId ?? children[0]?.id ?? ""
  );
  const [childText, setChildText] = useState("");
  const [childError, setChildError] = useState<string | null>(null);
  const childTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Teachers tab state ─────────────────────────────────────────────────
  const [selectedStudio, setSelectedStudio] = useState<LinkedStudio | null>(
    linkedStudios[0] ?? null
  );
  const [teacherMessages, setTeacherMessages] = useState<StudioMessage[]>([]);
  const [loadingTeacherMessages, setLoadingTeacherMessages] = useState(false);
  const [teacherText, setTeacherText] = useState("");
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const teacherTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Link teacher form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Family conversation ────────────────────────────────────────────────
  const selectedChild = children.find((c) => c.id === selectedChildId);
  const conversation = messages.filter(
    (m) =>
      (m.sender_id === parentId && m.recipient_id === selectedChildId) ||
      (m.sender_id === selectedChildId && m.recipient_id === parentId)
  );

  // ── Load teacher messages when selected studio changes ─────────────────
  useEffect(() => {
    if (!selectedStudio) return;

    setLoadingTeacherMessages(true);
    setTeacherMessages([]);

    getStudioMessagesForConversation(
      selectedStudio.studio_id,
      selectedStudio.teacher_id
    ).then((msgs) => {
      setTeacherMessages(msgs);
      setLoadingTeacherMessages(false);
    });
  }, [selectedStudio]);

  // Scroll to bottom on messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, teacherMessages, activeTab]);

  // Auto-resize textareas
  useEffect(() => {
    const ta = childTextareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [childText]);

  useEffect(() => {
    const ta = teacherTextareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [teacherText]);

  // ── Send to child ──────────────────────────────────────────────────────
  async function handleSendToChild() {
    if (!childText.trim() || !selectedChildId) return;
    setChildError(null);

    const content = childText.trim();
    setChildText("");

    startTransition(async () => {
      const result = await sendMessage(selectedChildId, content);
      if (result.error) {
        setChildError(result.error);
        setChildText(content);
      } else {
        router.refresh();
      }
    });
  }

  // ── Send to teacher ────────────────────────────────────────────────────
  async function handleSendToTeacher() {
    if (!teacherText.trim() || !selectedStudio) return;
    setTeacherError(null);

    const content = teacherText.trim();
    setTeacherText("");

    startTransition(async () => {
      const result = await sendStudioMessage(
        selectedStudio.teacher_id,
        content
      );
      if (result.error) {
        setTeacherError(result.error);
        setTeacherText(content);
      } else {
        // Optimistic update
        setTeacherMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            studio_id: selectedStudio.studio_id,
            sender_id: parentId,
            recipient_id: selectedStudio.teacher_id,
            content,
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ]);
        router.refresh();
      }
    });
  }

  // ── Link teacher ────────────────────────────────────────────────────────
  async function handleLinkTeacher() {
    if (!linkCode.trim()) return;
    setLinkError(null);
    setLinkSuccess(null);
    setLinkPending(true);

    const result = await linkParentToStudio(linkCode.trim());
    setLinkPending(false);

    if (result.error) {
      setLinkError(result.error);
    } else {
      setLinkSuccess(
        t("parent.messages.linkSuccess") +
          (result.studioName ? ` (${result.studioName})` : "")
      );
      setLinkCode("");
      // Auto-close form after showing success, then reload
      setTimeout(() => {
        setShowLinkForm(false);
        setLinkSuccess(null);
        router.refresh();
      }, 1500);
    }
  }

  function handleChildKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendToChild();
    }
  }

  function handleTeacherKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendToTeacher();
    }
  }

  // Count total unread from teachers
  const totalTeacherUnread = linkedStudios.reduce(
    (sum, s) => sum + s.unread_count,
    0
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("children")}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "children"
              ? "border-orange-500 bg-orange-500 text-white"
              : "border-border bg-white hover:border-orange-200"
          }`}
        >
          {t("parent.messages.childrenTab")}
        </button>
        <button
          onClick={() => setActiveTab("teachers")}
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "teachers"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-border bg-white hover:border-blue-200"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          {t("parent.messages.teachersTab")}
          {totalTeacherUnread > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {totalTeacherUnread}
            </span>
          )}
        </button>
      </div>

      {/* ── Children tab ──────────────────────────────────────────────── */}
      {activeTab === "children" && (
        <div className="space-y-4">
          {children.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent className="flex flex-col items-center gap-3">
                <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Voeg eerst een kind toe om berichten te sturen
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Child selector tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {children.map((child) => {
                  const unread = messages.filter(
                    (m) =>
                      m.sender_id === child.id &&
                      m.recipient_id === parentId &&
                      !m.is_read
                  ).length;

                  return (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        selectedChildId === child.id
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-border bg-white hover:border-orange-200"
                      }`}
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

              {/* Family message thread */}
              <Card>
                <CardContent className="p-0">
                  <div
                    className="max-h-96 min-h-32 overflow-y-auto p-4 space-y-3"
                    ref={activeTab === "children" ? scrollRef : undefined}
                  >
                    {conversation.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Nog geen berichten met {selectedChild?.display_name}.
                        <br />
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
                              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                isFromParent
                                  ? "bg-orange-500 text-white rounded-br-sm"
                                  : "bg-muted text-foreground rounded-bl-sm"
                              }`}
                            >
                              <p>{msg.content}</p>
                              <p
                                className={`text-[10px] mt-1 ${isFromParent ? "text-orange-200" : "text-muted-foreground"}`}
                              >
                                {new Date(msg.created_at).toLocaleTimeString(
                                  "nl-NL",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t" />

                  {/* Child compose area */}
                  <div className="flex items-end gap-2 p-3">
                    <textarea
                      ref={childTextareaRef}
                      rows={1}
                      value={childText}
                      onChange={(e) => setChildText(e.target.value)}
                      onKeyDown={handleChildKeyDown}
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
                      onClick={handleSendToChild}
                      disabled={
                        !childText.trim() || !selectedChildId || isPending
                      }
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

              {childError && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {childError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Teachers tab ──────────────────────────────────────────────── */}
      {activeTab === "teachers" && (
        <div className="space-y-4">
          {/* Studio selector */}
          {linkedStudios.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {linkedStudios.map((studio) => (
                <button
                  key={studio.studio_id}
                  onClick={() => setSelectedStudio(studio)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedStudio?.studio_id === studio.studio_id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-border bg-white hover:border-blue-200"
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  {studio.teacher_name}
                  {studio.unread_count > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                      {studio.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Teacher conversation thread */}
          {selectedStudio ? (
            <Card>
              <CardContent className="p-0">
                {/* Thread header */}
                <div className="border-b px-4 py-2.5">
                  <p className="text-sm font-semibold">
                    {selectedStudio.teacher_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStudio.studio_name}
                  </p>
                </div>

                {/* Messages */}
                <div
                  className="max-h-96 min-h-32 overflow-y-auto p-4 space-y-3"
                  ref={activeTab === "teachers" ? scrollRef : undefined}
                >
                  {loadingTeacherMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : teacherMessages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nog geen berichten met {selectedStudio.teacher_name}.
                      <br />
                      Stuur een bericht!
                    </p>
                  ) : (
                    teacherMessages.map((msg) => {
                      const isFromParent = msg.sender_id === parentId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isFromParent ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                              isFromParent
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            <p>{msg.content}</p>
                            <p
                              className={`text-[10px] mt-1 ${isFromParent ? "text-blue-200" : "text-muted-foreground"}`}
                            >
                              {new Date(msg.created_at).toLocaleTimeString(
                                "nl-NL",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t" />

                {/* Teacher compose */}
                <div className="flex items-end gap-2 p-3">
                  <textarea
                    ref={teacherTextareaRef}
                    rows={1}
                    value={teacherText}
                    onChange={(e) => setTeacherText(e.target.value)}
                    onKeyDown={handleTeacherKeyDown}
                    placeholder={t("parent.messages.placeholder")}
                    disabled={isPending}
                    className="min-h-[40px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-50"
                    style={{ maxHeight: "120px" }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendToTeacher}
                    disabled={!teacherText.trim() || isPending}
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
          ) : linkedStudios.length === 0 ? (
            <Card className="py-8 text-center">
              <CardContent className="flex flex-col items-center gap-3">
                <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t("parent.messages.noTeachers")}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {teacherError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {teacherError}
            </div>
          )}

          {/* Link teacher form */}
          <div className="rounded-lg border bg-muted/30 p-4">
            {!showLinkForm ? (
              <button
                onClick={() => setShowLinkForm(true)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                {t("parent.messages.linkTeacher")}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {t("parent.messages.linkTeacher")}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                    placeholder={t("parent.messages.teacherCodePlaceholder")}
                    className="max-w-48 font-mono uppercase"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLinkTeacher();
                    }}
                  />
                  <Button
                    onClick={handleLinkTeacher}
                    disabled={!linkCode.trim() || linkPending}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {linkPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verbinden…
                      </>
                    ) : (
                      "Koppelen"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowLinkForm(false);
                      setLinkCode("");
                      setLinkError(null);
                      setLinkSuccess(null);
                    }}
                  >
                    Annuleren
                  </Button>
                </div>
                {linkError && (
                  <p className="text-xs text-destructive">{linkError}</p>
                )}
                {linkSuccess && (
                  <p className="text-xs text-green-600">{linkSuccess}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Druk Enter om te versturen, Shift+Enter voor nieuwe regel
      </p>
    </div>
  );
}
