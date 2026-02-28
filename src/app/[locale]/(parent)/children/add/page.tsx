import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstruments } from "@/lib/actions/family";
import { AddChildForm } from "./AddChildForm";

/**
 * Page for adding a new child to the family.
 * Renders the AddChildForm client component with server-fetched instruments.
 */
export default async function AddChildPage({
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
          <Link href={`/${locale}/children`}>
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{t("parent.children.add")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Je kind kan daarna met een PIN inloggen
        </p>
      </div>

      <AddChildForm instruments={instruments} locale={locale} />
    </div>
  );
}
