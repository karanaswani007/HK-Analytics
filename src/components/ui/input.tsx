import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
