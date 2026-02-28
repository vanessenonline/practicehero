"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Music, Loader2, Mail, ArrowLeft } from "lucide-react";
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
import { useSupabase } from "@/providers/SupabaseProvider";

/**
 * Forgot Password page — sends a password reset email via Supabase Auth.
 * After submission, shows a confirmation message with instructions
 * to check their inbox.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations();
  const locale = useLocale();
  const supabase = useSupabase();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        // After clicking the email link, Supabase redirects here with a code
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
      }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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

      <Card>
        <CardHeader>
          <CardTitle>{t("auth.forgotPassword")}</CardTitle>
          <CardDescription>{t("auth.forgotPasswordDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            /* ── Success state ─────────────────────────────────── */
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Mail className="h-8 w-8" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">{t("auth.checkEmail")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("auth.resetEmailSent")}
                </p>
                <p className="text-sm font-medium text-primary">{email}</p>
              </div>
              <Link href="login">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("auth.backToLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            /* ── Email form ────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ouder@email.com"
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {loading ? t("common.loading") : t("auth.sendResetLink")}
              </Button>
              <div className="text-center">
                <Link
                  href="login"
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {t("auth.backToLogin")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
