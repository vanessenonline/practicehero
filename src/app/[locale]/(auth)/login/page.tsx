"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Music, Drum, Guitar, Piano, Lock, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabase } from "@/providers/SupabaseProvider";
import { loginChild, getFamilyChildren } from "@/lib/actions/auth";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";

/** Instrument icon map for child avatars */
const instrumentIcons: Record<string, React.ReactNode> = {
  piano: <Piano className="h-8 w-8" />,
  drums: <Drum className="h-8 w-8" />,
  guitar: <Guitar className="h-8 w-8" />,
};

interface FamilyChild {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const supabase = useSupabase();

  // Parent login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Child login state
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<FamilyChild | null>(null);
  const [pin, setPin] = useState("");
  const [childError, setChildError] = useState("");
  const [childLoading, setChildLoading] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Load remembered family children on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("practicehero_family_id");
      if (stored) {
        setFamilyId(stored);
        loadChildren(stored);
      }
    } catch {
      // localStorage may not be available
    }
  }, []);

  async function loadChildren(fid: string) {
    const result = await getFamilyChildren(fid);
    if (result.children.length > 0) {
      setChildren(result.children);
    }
  }

  // ── Parent login ────────────────────────────────────────────────────────

  async function handleParentLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // The middleware will redirect to /dashboard on next request
    router.push(`/${locale}/dashboard`);
    router.refresh();
  }

  // ── Child login ─────────────────────────────────────────────────────────

  async function handleChildLogin() {
    if (!selectedChild || pin.length !== 4) return;

    setChildLoading(true);
    setChildError("");

    const result = await loginChild(selectedChild.id, pin);

    if (result.error) {
      setChildError(result.error);
      setPin("");
      setChildLoading(false);
      return;
    }

    router.push(`/${locale}/home`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Logo / Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-purple-600 text-white shadow-lg">
            <Music className="h-8 w-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
          {t("common.appName")}
        </h1>
      </div>

      <Tabs defaultValue="parent" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="parent">{t("auth.parentLogin")}</TabsTrigger>
          <TabsTrigger value="child">{t("auth.childLogin")}</TabsTrigger>
          <TabsTrigger value="student">Leerling</TabsTrigger>
        </TabsList>

        {/* ── Parent Login Tab ───────────────────────────────────────── */}
        <TabsContent value="parent">
          <Card>
            <CardHeader>
              <CardTitle>{t("auth.login")}</CardTitle>
              <CardDescription>{t("auth.welcomeBack")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleParentLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ouder@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {loading ? t("common.loading") : t("auth.login")}
                </Button>
              </form>
              <div className="mt-3 text-center">
                <Link
                  href="forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <div className="mt-3 text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link href="register" className="text-primary underline">
                  {t("auth.register")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Child Login Tab ────────────────────────────────────────── */}
        <TabsContent value="child">
          <Card>
            <CardHeader>
              <CardTitle>{t("auth.childLogin")}</CardTitle>
              <CardDescription>{t("auth.enterPin")}</CardDescription>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                /* No children registered yet */
                <div className="text-center space-y-4 py-4">
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                      <User className="h-8 w-8" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("auth.noChildrenYet")}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Child avatar selection */}
                  <div className="flex justify-center gap-4 flex-wrap">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          setSelectedChild(child);
                          setPin("");
                          setChildError("");
                        }}
                        className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-all ${
                          selectedChild?.id === child.id
                            ? "bg-orange-100 ring-2 ring-orange-500 scale-105"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-full ${
                            selectedChild?.id === child.id
                              ? "bg-orange-200 text-orange-700"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <Music className="h-8 w-8" />
                        </div>
                        <span className="text-sm font-medium">
                          {child.display_name}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* PIN Input — shown after selecting a child */}
                  {selectedChild && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="pin"
                          className="flex items-center gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          PIN voor {selectedChild.display_name}
                        </Label>
                        <Input
                          id="pin"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pin}
                          onChange={(e) =>
                            setPin(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="••••"
                          className="text-center text-2xl tracking-[0.5em]"
                          autoFocus
                        />
                      </div>

                      {childError && (
                        <p className="text-sm text-destructive">
                          {childError}
                        </p>
                      )}

                      <Button
                        className="w-full"
                        disabled={pin.length !== 4 || childLoading}
                        onClick={handleChildLogin}
                      >
                        {childLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t("common.start")} 🎵
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Student Login Tab ──────────────────────────────────────── */}
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <CardTitle>Leerling inloggen</CardTitle>
              <CardDescription>
                Voer je leraar- en leerlingcode in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentLoginForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
