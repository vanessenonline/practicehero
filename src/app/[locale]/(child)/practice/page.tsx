import { redirect } from "next/navigation";

/**
 * Practice index redirects to child home to pick an instrument.
 */
export default async function PracticePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/home`);
}
