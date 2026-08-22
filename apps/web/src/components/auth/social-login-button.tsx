import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { GoogleIcon } from "../ui/google-icon";
import { FacebookIcon } from "../ui/facebook-icon";

interface SocialLoginButtonProps {
  provider: "google" | "facebook";
  children?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function SocialLoginButton({
  provider,
  children,
  isLoading = false,
  disabled = false,
  onClick,
}: SocialLoginButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {!isLoading && provider === "google" && <GoogleIcon />}
      {!isLoading && provider === "facebook" && <FacebookIcon />}
      {children || `${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
    </Button>
  );
}
