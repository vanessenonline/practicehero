"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  Package,
} from "lucide-react";
import {
  purchaseItem,
  useStreakRestorer,
  usePauseDay,
} from "@/lib/actions/shop";
import type { ShopItem } from "@/types/database";
import type { InventoryItem } from "@/lib/actions/shop";

interface ShopClientProps {
  items: ShopItem[];
  balance: number;
  inventory: InventoryItem[];
  streakStatus: string | null;
}

/**
 * Client component for the shop with Store and Inventory tabs.
 * Handles buying items and using purchased items.
 */
export function ShopClient({
  items,
  balance: initialBalance,
  inventory: initialInventory,
  streakStatus,
}: ShopClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<"store" | "inventory">("store");
  const [balance, setBalance] = useState(initialBalance);
  const [inventory, setInventory] = useState(initialInventory);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [justBought, setJustBought] = useState<Set<string>>(new Set());
  const [justUsed, setJustUsed] = useState<Set<string>>(new Set());

  function handleBuy(item: ShopItem) {
    if (isPending) return;

    setBuyingId(item.id);
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });

    startTransition(async () => {
      const result = await purchaseItem(item.id);
      setBuyingId(null);

      if (result.error) {
        setErrors((prev) => new Map(prev).set(item.id, result.error!));
      } else {
        setBalance((prev) => prev - item.cost_credits);
        setJustBought((prev) => new Set(prev).add(item.id));
        router.refresh();
        setTimeout(() => {
          setJustBought((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }, 3000);
      }
    });
  }

  function handleUse(inventoryItem: InventoryItem) {
    if (isPending) return;

    const purchaseId = inventoryItem.purchase.id;
    const itemType = inventoryItem.shopItem.item_type;

    setUsingId(purchaseId);
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(purchaseId);
      return next;
    });

    startTransition(async () => {
      const result =
        itemType === "streak_restorer"
          ? await useStreakRestorer(purchaseId)
          : await usePauseDay(purchaseId);

      setUsingId(null);

      if (result.error) {
        setErrors((prev) => new Map(prev).set(purchaseId, result.error!));
      } else {
        // Remove from local inventory
        setInventory((prev) =>
          prev.filter((i) => i.purchase.id !== purchaseId)
        );
        setJustUsed((prev) => new Set(prev).add(purchaseId));
        router.refresh();
        setTimeout(() => {
          setJustUsed((prev) => {
            const next = new Set(prev);
            next.delete(purchaseId);
            return next;
          });
        }, 3000);
      }
    });
  }

  return (
    <>
      {/* Balance header */}
      <div className="py-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-5 py-2.5">
          <Zap className="h-5 w-5 text-purple-600" />
          <span className="font-bold text-purple-600">
            {t("shop.balance", { count: balance })}
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab("store")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === "store"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          {t("shop.store")}
        </button>
        <button
          onClick={() => setTab("inventory")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === "inventory"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          {t("shop.inventory")}
          {inventory.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 justify-center px-1 text-xs"
            >
              {inventory.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Store tab */}
      {tab === "store" && (
        <div className="grid gap-3">
          {items.map((item) => {
            const isBuying = buyingId === item.id;
            const canAfford = balance >= item.cost_credits;
            const errorMsg = errors.get(item.id);
            const boughtNow = justBought.has(item.id);

            return (
              <Card key={item.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-2xl">
                    {item.icon ?? "🎁"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t(item.name_key as Parameters<typeof t>[0])}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {t(item.description_key as Parameters<typeof t>[0])}
                    </p>
                    {errorMsg && (
                      <p className="mt-1 text-xs text-destructive">
                        {errorMsg}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {boughtNow ? (
                      <Badge className="gap-1 whitespace-nowrap bg-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("shop.purchased")}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={canAfford ? "default" : "outline"}
                        disabled={!canAfford || isPending}
                        onClick={() => handleBuy(item)}
                        className="gap-1 whitespace-nowrap"
                      >
                        {isBuying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        {item.cost_credits}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {balance === 0 && items.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Oefen meer voor Super Credits! 💪
            </p>
          )}
        </div>
      )}

      {/* Inventory tab */}
      {tab === "inventory" && (
        <div className="grid gap-3">
          {inventory.length === 0 && !justUsed.size ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">{t("shop.noItems")}</p>
              </CardContent>
            </Card>
          ) : (
            inventory.map((inv) => {
              const isUsing = usingId === inv.purchase.id;
              const errorMsg = errors.get(inv.purchase.id);
              const isStreakRestorer =
                inv.shopItem.item_type === "streak_restorer";
              const canUseRestorer =
                isStreakRestorer &&
                streakStatus !== "active";

              return (
                <Card key={inv.purchase.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-2xl">
                      {inv.shopItem.icon ?? "🎁"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t(
                          inv.shopItem.name_key as Parameters<typeof t>[0]
                        )}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {t(
                          inv.shopItem.description_key as Parameters<
                            typeof t
                          >[0]
                        )}
                      </p>
                      {errorMsg && (
                        <p className="mt-1 text-xs text-destructive">
                          {errorMsg}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isStreakRestorer && !canUseRestorer ? (
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap text-xs"
                        >
                          {t("shop.streakNotBroken")}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isPending}
                          onClick={() => handleUse(inv)}
                          className="gap-1 whitespace-nowrap bg-green-600 hover:bg-green-700"
                        >
                          {isUsing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {t("shop.use")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
