import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/actions/settings";
import { SettingsClient } from "./SettingsClient";

/**
 * Parent settings page – server component that loads the profile,
 * then delegates to SettingsClient for interactive editing.
 */
export default async function SettingsPage() {
  const t = await getTranslations();
  const { profile, error } = await getSettings();

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <div className="py-8 text-center text-muted-foreground">
          {error ?? "Kon instellingen niet laden"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      <SettingsClient profile={profile} />
    </div>
  );
}
