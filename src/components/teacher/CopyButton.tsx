"use client";

import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  /** The text to copy to the clipboard. */
  text: string;
  /** Optional accessible label. */
  label?: string;
}

/**
 * Small button that copies `text` to the clipboard on click.
 * Must be a Client Component because it uses onClick + navigator.clipboard.
 */
export function CopyButton({ text, label = "Kopieer" }: CopyButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {
          // Clipboard API not available (e.g. non-secure context) — fail silently.
        });
      }}
      className="text-muted-foreground"
      title={label}
    >
      📋
    </Button>
  );
}
