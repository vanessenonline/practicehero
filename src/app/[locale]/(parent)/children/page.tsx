import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, UserPlus, Settings, Music } from "lucide-react";
import { getChildren } from "@/lib/actions/family";

/**
 * Children management page – lists all children in the family.
 * Parents can add new children or click through to manage a child.
 */
export default async function ChildrenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const { children, error } = await getChildren();

  function instIcon(nameKey: string): string {
    const icons: Record<string, string> = {
      piano: "🎹",
      drums: "🥁",
      guitar: "🎸",
      keyboard: "🎹",
      violin: "🎻",
    };
    return icons[nameKey] ?? "🎵";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.children")}</h1>
        <Button asChild>
          <Link href={`/${locale}/children/add`}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("parent.children.add")}
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t("common.error")}: {error}
        </div>
      )}

      {/* Empty state */}
      {!error && children.length === 0 && (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <Music className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-lg">Nog geen kinderen</p>
              <p className="text-sm text-muted-foreground mt-1">
                Voeg je eerste kind toe om aan de slag te gaan
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={`/${locale}/children/add`}>
                <UserPlus className="mr-2 h-5 w-5" />
                {t("parent.children.add")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Children list */}
      {children.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map(({ profile, instruments, streak }) => (
            <Card key={profile.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar circle */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-purple-500 text-xl text-white font-bold">
                      {profile.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{profile.display_name}</CardTitle>
                      {streak && (
                        <div className="flex items-center gap-1 text-orange-500">
                          <Flame className="h-3.5 w-3.5" />
                          <span className="text-sm font-medium">
                            {streak.current_count} {streak.current_count === 1 ? "dag" : "dagen"} streak
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/${locale}/children/${profile.id}`}>
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Instruments */}
                <div className="flex flex-wrap gap-1.5">
                  {instruments.length > 0 ? (
                    instruments.map((ci) => (
                      <Badge key={ci.id} variant="secondary" className="gap-1">
                        <span>{instIcon(ci.instrument.name_key)}</span>
                        {t(`instruments.${ci.instrument.name_key}` as Parameters<typeof t>[0])}
                        {ci.is_primary && (
                          <span className="text-xs text-orange-500">★</span>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Geen instrument ingesteld</span>
                  )}
                </div>

                {/* Streak status */}
                {streak && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {streak.status === "active" && `Langste streak: ${streak.longest_count} dagen`}
                    {streak.status === "recovery" && `Herstelmodus: ${streak.recovery_sessions_needed} sessies nodig`}
                    {streak.status === "broken" && "Streak verbroken – begin opnieuw!"}
                  </div>
                )}

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/${locale}/children/${profile.id}`}>
                    Beheer kind
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
