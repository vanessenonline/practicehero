"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Music, Loader2, CheckCircle, Mail } from "lucide-react";
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
import { registerTeacher } from "@/lib/actions/auth";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const supabase = useSupabase();

  // Parent registration state
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Teacher registration state
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState("");
  const [studioName, setStudioName] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherNeedsConfirmation, setTeacherNeedsConfirmation] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Client-side validation
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      setLoading(false);
      return;
    }

    // Sign up via Supabase Auth — the database trigger will
    // auto-create the family and profile rows.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          family_name: familyName,
          role: "parent",
          display_name: familyName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // When email confirmation is enabled, no session is returned.
    if (data.user && !data.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    // Session exists — full page reload so new session cookies are available
    // for server-side RLS queries on the next request.
    if (data.session) {
      window.location.href = `/${locale}/dashboard`;
    }
  }

  async function handleTeacherRegister(e: React.FormEvent) {
    e.preventDefault();
    setTeacherLoading(true);
    setTeacherError("");

    // Client-side validation
    if (teacherPassword !== teacherConfirmPassword) {
      setTeacherError("Wachtwoorden komen niet overeen");
      setTeacherLoading(false);
      return;
    }

    if (teacherPassword.length < 6) {
      setTeacherError("Wachtwoord moet minimaal 6 tekens zijn");
      setTeacherLoading(false);
      return;
    }

    if (!studioName.trim()) {
      setTeacherError("Studioname is verplicht");
      setTeacherLoading(false);
      return;
    }

    // Register teacher + create studio atomically in one server action.
    // This avoids the race condition where createStudio() was called before
    // the needsConfirmation check, causing a "not logged in" error when
    // email confirmation is required (no active session yet).
    const result = await registerTeacher(teacherEmail, teacherPassword, studioName);

    if (result.error) {
      setTeacherError(result.error);
      setTeacherLoading(false);
      return;
    }

    // Email confirmation required — studio is already created, just show confirmation screen
    if (result.needsConfirmation) {
      setTeacherNeedsConfirmation(true);
      setTeacherLoading(false);
      return;
    }

    // Success — full page reload to /teacher/dashboard.
    // Must use window.location.href (not router.push) so the browser processes
    // the new session cookies from signUp() before the next server request.
    // router.push() is a client-side navigation that may not include the new
    // session cookies, causing RLS queries to fail (same pattern as logout).
    window.location.href = `/${locale}/teacher/dashboard`;
  }

  // ── Email confirmation screen ────────────────────────────────────
  if (needsConfirmation || teacherNeedsConfirmation) {
    const confirmEmail = needsConfirmation ? email : teacherEmail;
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
              <Mail className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {t("auth.checkEmail")}
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-muted-foreground">
                {t("auth.confirmationSent")}
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                {confirmEmail}
              </p>
              <Link href="login">
                <Button variant="outline" className="mt-4">
                  {t("auth.backToLogin")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────
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

      <Card>
        <Tabs defaultValue="parent" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parent">Ouder</TabsTrigger>
            <TabsTrigger value="teacher">Leraar</TabsTrigger>
          </TabsList>

          {/* Parent registration */}
          <TabsContent value="parent">
            <CardHeader>
              <CardTitle>{t("auth.register")}</CardTitle>
              <CardDescription>{t("auth.createFamily")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="familyName">{t("auth.familyName")}</Label>
              <Input
                id="familyName"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Familie De Vries"
                required
              />
            </div>
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
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("auth.confirmPassword")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {loading ? t("common.loading") : t("auth.register")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <Link href="login" className="text-primary underline">
              {t("auth.login")}
            </Link>
          </div>
            </CardContent>
          </TabsContent>

          {/* Teacher registration */}
          <TabsContent value="teacher">
            <CardHeader>
              <CardTitle>Leraar Account</CardTitle>
              <CardDescription>Maak een account aan voor je lespraktijk</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTeacherRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studioName">Studio Naam</Label>
                  <Input
                    id="studioName"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Mijn Muziekles"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherEmail">E-mail</Label>
                  <Input
                    id="teacherEmail"
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    placeholder="leraar@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherPassword">Wachtwoord</Label>
                  <Input
                    id="teacherPassword"
                    type="password"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherConfirmPassword">
                    Bevestig Wachtwoord
                  </Label>
                  <Input
                    id="teacherConfirmPassword"
                    type="password"
                    value={teacherConfirmPassword}
                    onChange={(e) => setTeacherConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {teacherError && (
                  <p className="text-sm text-destructive">{teacherError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={teacherLoading}
                >
                  {teacherLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {teacherLoading ? "Account aanmaken..." : "Account aanmaken"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {t("auth.hasAccount")}{" "}
                <Link href="login" className="text-primary underline">
                  {t("auth.login")}
                </Link>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
