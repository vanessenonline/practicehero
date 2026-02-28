import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstruments } from "@/lib/actions/family";
import { getCourses } from "@/lib/actions/teacher";
import { AddStudentForm } from "../AddStudentForm";

/**
 * Page for adding a new student to the teacher's studio.
 * Renders the AddStudentForm client component with server-fetched instruments and courses.
 */
export default async function AddStudentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const instruments = await getInstruments();
  const courses = await getCourses();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/teacher/students`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{t("teacher.students.add")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          De leerling kan daarna met een code en PIN inloggen
        </p>
      </div>

      <AddStudentForm
        instruments={instruments}
        courses={courses}
        locale={locale}
      />
    </div>
  );
}
