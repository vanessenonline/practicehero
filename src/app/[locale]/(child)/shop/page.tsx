import { getTranslations } from "next-intl/server";
import { getShopData } from "@/lib/actions/shop";
import { ShopClient } from "./ShopClient";

/**
 * Super Credits shop – server component that fetches items, balance,
 * inventory and streak status, then passes to ShopClient.
 */
export default async function ShopPage() {
  const t = await getTranslations();
  const { data, error } = await getShopData();

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="py-2 text-center">
          <h1 className="text-2xl font-bold">{t("shop.title")}</h1>
        </div>
        <div className="py-8 text-center text-muted-foreground">
          {error ?? "Kon winkel niet laden"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="py-2 text-center">
        <h1 className="text-2xl font-bold">{t("shop.title")}</h1>
      </div>

      <ShopClient
        items={data.items}
        balance={data.balance}
        inventory={data.inventory}
        streakStatus={data.streakStatus}
      />
    </div>
  );
}
