import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  iconVariant?: "accent" | "muted";
  heading: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  iconVariant = "muted",
  heading,
  body,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn(
        "mb-4 rounded-full p-6",
        iconVariant === "accent" ? "bg-accent/10" : "bg-muted"
      )}>
        <Icon className={cn(
          "h-8 w-8",
          iconVariant === "accent" ? "text-accent" : "text-muted-foreground"
        )} aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold">{heading}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
