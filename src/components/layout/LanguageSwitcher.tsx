"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

/**
 * Simple language toggle between Dutch and English.
 */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = pathname.split("/")[1];
  const otherLocale = currentLocale === "nl" ? "en" : "nl";

  function switchLocale() {
    const newPath = pathname.replace(`/${currentLocale}`, `/${otherLocale}`);
    router.push(newPath);
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchLocale} className="gap-1.5">
      <Globe className="h-4 w-4" />
      <span className="uppercase text-xs font-medium">{otherLocale}</span>
    </Button>
  );
}
