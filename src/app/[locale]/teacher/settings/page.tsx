import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Settings } from "lucide-react";
import { getStudio } from "@/lib/actions/teacher";

/**
 * Teacher settings page – manage studio name, teacher code, and other settings.
 * Displays studio information and copy buttons for sharing codes.
 */
export default async function TeacherSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const studio = await getStudio();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">{t("nav.teacher.settings")}</h1>
      </div>

      {/* Studio Information */}
      {studio ? (
        <div className="space-y-4">
          {/* Studio Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Studiogegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Studioname
                </p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{studio.name}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(studio.name)}
                    className="text-muted-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Teacher Code */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Leeraarcode (delen met leerlingen)
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-2xl font-bold tracking-wider font-mono bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                    {studio.teacher_code}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigator.clipboard.writeText(studio.teacher_code)
                    }
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Leerlingen hebben deze code nodig om in te loggen
                </p>
              </div>

              {/* Account Status */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Accountstatus
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    Actief
                  </Badge>
                  <Badge variant="secondary">Leeraar</Badge>
                </div>
              </div>

              {/* Dates */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Aanmaakdatum
                </p>
                <p className="text-sm">
                  {new Date(studio.created_at).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leerlingen toevoegen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-2">Stap 1: Geef je leeraarcode</p>
                <p className="text-muted-foreground">
                  Deel je leeraarcode (T-XXXX) met je leerlingen
                </p>
              </div>
              <div>
                <p className="font-semibold mb-2">Stap 2: Voeg leerling toe</p>
                <p className="text-muted-foreground">
                  Ga naar Leerlingen en voeg elke leerling afzonderlijk toe
                </p>
              </div>
              <div>
                <p className="font-semibold mb-2">Stap 3: Geef leerlingcode</p>
                <p className="text-muted-foreground">
                  Je krijgt een unieke leerlingcode (S-XXXX) voor elke leerling
                </p>
              </div>
              <div>
                <p className="font-semibold mb-2">Stap 4: Leerling logt in</p>
                <p className="text-muted-foreground">
                  Leerling kiest "Leerling" op inlogpagina en voert in:
                  <br />
                  • Leeraarcode (T-XXXX)
                  <br />
                  • Leerlingcode (S-XXXX)
                  <br />
                  • PIN (4 cijfers)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Over PracticeHero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                PracticeHero helpt leerlingen met consistente oefengewoonten
                door gamification en voortgangsmonitoring.
              </p>
              <p>
                Onderwijzers kunnen cursussen aanmaken, leerlingen toevoegen,
                en voortgang volgen.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Studio niet gevonden. Gelieve opnieuw in te loggen.
          </p>
          <Button asChild>
            <a href={`/${locale}/login`}>Inloggen</a>
          </Button>
        </Card>
      )}
    </div>
  );
}
