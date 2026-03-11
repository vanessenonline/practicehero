"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Confirmation dialog shown before logging out.
 * Prevents accidental logouts by asking the user to confirm.
 * Uses the existing AlertDialog component with a small (sm) size variant.
 */
interface LogoutConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog open state changes (e.g., user clicks overlay or cancel) */
  onOpenChange: (open: boolean) => void;
  /** Callback when the user confirms the logout action */
  onConfirm: () => void;
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const t = useTranslations("auth");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-50">
            <LogOut className="h-6 w-6 text-red-500" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("logoutConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("logoutConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("logoutConfirmCancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("logoutConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
