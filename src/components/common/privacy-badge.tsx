import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PrivacyBadgeProps {
  className?: string;
}

export function PrivacyBadge({ className }: PrivacyBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-pd-muted",
        className
      )}
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
      <span>Files auto-delete after 2 hours</span>
    </div>
  );
}
