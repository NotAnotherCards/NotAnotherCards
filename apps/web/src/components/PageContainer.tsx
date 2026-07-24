import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageContainer({
  title,
  description,
  action,
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 sm:py-8 flex flex-col gap-6",
        className
      )}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
          <div className="space-y-1">
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-heading">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 mt-2 sm:mt-0">{action}</div>}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-6">{children}</div>
    </div>
  );
}
