import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative w-full" data-slot="password-input">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all outline-none rounded p-1 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="size-4 select-none pointer-events-none" />
        ) : (
          <Eye className="size-4 select-none pointer-events-none" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
