import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Music } from "lucide-react";
import { getStudents } from "@/lib/actions/teacher";

/**
 * Students list page – displays all students in the teacher's studio.
 * Shows student code, current level/lesson, and links to detail/management pages.
 */
export default async function StudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  const students = await getStudents();

  // Map instrument name_key to emoji
  function instIcon(nameKey: string): string {
    const icons: Record<string, string> = {
      piano: "🎹",
      drums: "🥁",
      guitar: "🎸",
      keyboard: "🎹",
      violin: "🎻",
      trumpet: "🎺",
    };
    return icons[nameKey] ?? "🎵";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.teacher.students")}</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} {students.length === 1 ? "leerling" : "leerlingen"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${locale}/teacher/students/add`}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("teacher.students.add")}
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {students.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Music className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">{t("teacher.students.empty")}</p>
              <p className="text-sm text-muted-foreground">
                {t("teacher.students.emptyHint")}
              </p>
            </div>
            <Button asChild>
              <Link href={`/${locale}/teacher/students/add`}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {t("teacher.students.add")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Students grid */}
      {students.length > 0 && (
        <div className="space-y-3">
          {students.map((student) => (
            <Card key={student.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold truncate">
                        {student.student_code}
                      </h3>
                      {student.is_active ? (
                        <Badge variant="default" className="bg-green-500">
                          Actief
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactief
                        </Badge>
                      )}
                    </div>

                    {/* Progress info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        Niveau {student.current_level} • Les{" "}
                        {student.current_lesson}
                      </span>
                      {student.course_id && (
                        <Badge variant="secondary" className="text-xs">
                          Gelijkreks
                        </Badge>
                      )}
                    </div>

                    {/* Date info */}
                    <p className="text-xs text-muted-foreground mt-1">
                      Sinds{" "}
                      {new Date(student.start_date).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      {student.target_end_date &&
                        ` • t/m ${new Date(
                          student.target_end_date
                        ).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}`}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/${locale}/teacher/students/${student.student_id}`}>
                        Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
