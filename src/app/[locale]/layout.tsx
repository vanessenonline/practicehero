import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "../../../i18n/routing";
import { SupabaseProvider } from "@/providers/SupabaseProvider";

/**
 * Locale layout - wraps children with i18n and Supabase providers.
 * The html/body tags are handled by the root layout.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SupabaseProvider>
        {children}
      </SupabaseProvider>
    </NextIntlClientProvider>
  );
}
