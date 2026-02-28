import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { getChildren } from "@/lib/actions/family";
import { getContentForChild } from "@/lib/actions/content";
import { createClient } from "@/lib/supabase/server";
import { ContentForm } from "./ContentForm";

/**
 * Parent content management page for a specific child.
 * Allows setting the lesson of the week and motivator per instrument.
 */
export default async function ChildContentPage({
  params,
}: {
  params: Promise<{ locale: string; childId: string }>;
}) {
  const { locale, childId } = await params;
  const t = await getTranslations();

  // Verify child belongs to this family
  const { children } = await getChildren();
  const child = children.find((c) => c.profile.id === childId);

  if (!child) {
    notFound();
  }

  // Fetch instruments with full data
  const supabase = await createClient();
  const { data: allInstruments } = await supabase
    .from("instruments")
    .select("*");

  // Fetch existing content
  const { content } = await getContentForChild(childId);

  // Build instrument + content pairs
  const instrumentContent = child.instruments.map((ci) => {
    const instrument = (allInstruments ?? []).find(
      (inst) => inst.id === ci.instrument_id
    );
    const forThisInstrument = content.find(
      (c) => c.instrumentId === ci.instrument_id
    );
    return {
      instrument: instrument!,
      lesson: forThisInstrument?.lesson ?? null,
      motivator: forThisInstrument?.motivator ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/children/${childId}`}>
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("parent.children.content")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Les en uitdaging voor {child.profile.display_name}
        </p>
      </div>

      <ContentForm
        childId={childId}
        childName={child.profile.display_name}
        instrumentContent={instrumentContent.filter((ic) => ic.instrument != null)}
      />
    </div>
  );
}
