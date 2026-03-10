import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstruments } from "@/lib/actions/family";
import { AddCourseForm } from "../AddCourseForm";

/**
 * Page for adding a new course to the teacher's studio.
 * Renders the AddCourseForm client component with server-fetched instruments.
 */
export default async function AddCoursePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const instruments = await getInstruments();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/courses`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{t("teacher.courses.add")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maak een nieuwe cursus aan met lessen en niveaus
        </p>
      </div>

      <AddCourseForm instruments={instruments} locale={locale} />
    </div>
  );
}
