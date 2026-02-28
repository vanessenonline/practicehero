"use server";

import { createClient } from "@/lib/supabase/server";
import type { ShopItem, Purchase } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseResult {
  success?: boolean;
  error?: string;
}

export interface UseItemResult {
  success?: boolean;
  error?: string;
}

export interface InventoryItem {
  purchase: Purchase;
  shopItem: ShopItem;
}

/**
 * Purchase a shop item using super credits.
 * Validates the child has enough credits, creates a purchase row,
 * and deducts credits via a negative super_credits entry.
 */
export async function purchaseItem(
  shopItemId: string
): Promise<PurchaseResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "child") {
    return { error: "Alleen kinderen kunnen artikelen kopen." };
  }

  // Get the shop item
  const { data: item } = await supabase
    .from("shop_items")
    .select("*")
    .eq("id", shopItemId)
    .eq("is_active", true)
    .single();

  if (!item) return { error: "Artikel niet gevonden." };

  // Calculate current super credit balance
  const { data: creditEntries } = await supabase
    .from("super_credits")
    .select("amount")
    .eq("child_id", user.id);

  const balance = (creditEntries ?? []).reduce(
    (sum, c) => sum + c.amount,
    0
  );

  if (balance < item.cost_credits) {
    return { error: `Niet genoeg Super Credits. Je hebt ${balance}, je hebt ${item.cost_credits} nodig.` };
  }

  // Create the purchase record
  const { error: purchaseError } = await supabase.from("purchases").insert({
    child_id: user.id,
    shop_item_id: shopItemId,
    family_id: profile.family_id,
    used: false,
  });

  if (purchaseError) {
    return { error: purchaseError.message };
  }

  // Deduct credits (negative entry)
  await supabase.from("super_credits").insert({
    child_id: user.id,
    family_id: profile.family_id,
    amount: -item.cost_credits,
    source: "purchase",
    reference_id: shopItemId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Fetch shop data for the child
// ---------------------------------------------------------------------------

export interface ShopData {
  items: ShopItem[];
  balance: number;
  inventory: InventoryItem[];
  streakStatus: string | null;
}

/**
 * Fetch all active shop items, child's credit balance, unused inventory,
 * and current streak status.
 */
export async function getShopData(): Promise<{
  data: ShopData | null;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Niet ingelogd." };

  const [itemsResult, creditsResult, purchasesResult, streakResult] = await Promise.all([
    supabase.from("shop_items").select("*").eq("is_active", true).order("cost_credits"),
    supabase.from("super_credits").select("amount").eq("child_id", user.id),
    supabase
      .from("purchases")
      .select("*, shop_items(*)")
      .eq("child_id", user.id)
      .eq("used", false)
      .order("created_at", { ascending: false }),
    supabase.from("streaks").select("status").eq("child_id", user.id).single(),
  ]);

  const balance = (creditsResult.data ?? []).reduce(
    (sum, c) => sum + c.amount,
    0
  );

  const inventory: InventoryItem[] = (purchasesResult.data ?? []).map(
    (p: Record<string, unknown>) => ({
      purchase: {
        id: p.id,
        child_id: p.child_id,
        shop_item_id: p.shop_item_id,
        family_id: p.family_id,
        used: p.used,
        used_at: p.used_at,
        created_at: p.created_at,
      } as Purchase,
      shopItem: p.shop_items as ShopItem,
    })
  );

  return {
    data: {
      items: itemsResult.data ?? [],
      balance,
      inventory,
      streakStatus: streakResult.data?.status ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Use a Streak Restorer
// ---------------------------------------------------------------------------

/**
 * Use a purchased Streak Restorer to restore a broken streak.
 * Resets streak status to 'active' with count of 1 and today's date.
 */
export async function useStreakRestorer(
  purchaseId: string
): Promise<UseItemResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  // Verify purchase belongs to user and is unused
  const { data: purchase } = await supabase
    .from("purchases")
    .select("*, shop_items(item_type)")
    .eq("id", purchaseId)
    .eq("child_id", user.id)
    .eq("used", false)
    .single();

  if (!purchase) return { error: "Item niet gevonden of al gebruikt." };

  const itemType = (purchase.shop_items as { item_type: string })?.item_type;
  if (itemType !== "streak_restorer") {
    return { error: "Dit is geen Streak Hersteller." };
  }

  // Check streak is actually broken (not active)
  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("child_id", user.id)
    .single();

  if (!streak) return { error: "Geen streak gevonden." };
  if (streak.status === "active" && streak.current_count > 0) {
    return { error: "Je streak is niet verbroken." };
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Restore streak: set back to longest_count (or at least 1)
  // and mark as active. The child still needs to practice today.
  const restoredCount = Math.max(streak.longest_count, 1);
  await supabase
    .from("streaks")
    .update({
      current_count: restoredCount,
      status: "active",
      last_practice_date: todayStr,
      missed_days: 0,
      recovery_sessions_needed: 0,
    })
    .eq("child_id", user.id);

  // Mark purchase as used
  await supabase
    .from("purchases")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", purchaseId);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Use a Pause Day
// ---------------------------------------------------------------------------

/**
 * Use a purchased Pause Day to protect the streak for today.
 * Adds today's date to the streak's grace_dates array.
 */
export async function usePauseDay(
  purchaseId: string
): Promise<UseItemResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  // Verify purchase belongs to user and is unused
  const { data: purchase } = await supabase
    .from("purchases")
    .select("*, shop_items(item_type)")
    .eq("id", purchaseId)
    .eq("child_id", user.id)
    .eq("used", false)
    .single();

  if (!purchase) return { error: "Item niet gevonden of al gebruikt." };

  const itemType = (purchase.shop_items as { item_type: string })?.item_type;
  if (itemType !== "pause_day") {
    return { error: "Dit is geen Pauzedag." };
  }

  // Get current streak
  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("child_id", user.id)
    .single();

  if (!streak) return { error: "Geen streak gevonden." };

  const todayStr = new Date().toISOString().split("T")[0];

  // Add today to grace_dates so streak logic skips this day
  const graceDates = [...(streak.grace_dates ?? []), todayStr];
  await supabase
    .from("streaks")
    .update({
      grace_dates: graceDates,
      last_practice_date: todayStr,
    })
    .eq("child_id", user.id);

  // Mark purchase as used
  await supabase
    .from("purchases")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", purchaseId);

  return { success: true };
}
