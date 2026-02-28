import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["nl", "en"],
  defaultLocale: "nl",
});

/**
 * Locale-aware navigation utilities.
 * These automatically prepend the current locale to paths.
 * Use instead of next/navigation equivalents.
 */
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
