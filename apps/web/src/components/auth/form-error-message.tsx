import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string | string[] | null;
}

export const FormErrorMessage = React.forwardRef<
  HTMLDivElement,
  FormErrorMessageProps
>(({ className, message, ...props }, ref) => {
  if (!message) return null;

  const messages = Array.isArray(message)
    ? message.filter(Boolean)
    : [message].filter(Boolean);

  if (messages.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200",
        className,
      )}
      {...props}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-left w-full">
        {messages.length === 1 ? (
          <p className="font-medium">{messages[0]}</p>
        ) : (
          <ul className="list-disc pl-4 font-medium space-y-1">
            {messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

FormErrorMessage.displayName = "FormErrorMessage";
