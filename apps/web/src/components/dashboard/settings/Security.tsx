import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { Save, Check, Shield, LogOut } from "lucide-react";
import { FormErrorMessage } from "@/components/auth/form-error-message";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function Security() {
  const navigate = useNavigate();
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setSecurityError(null);
    setSecuritySuccess(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message || "Failed to update password");
      }

      setSecuritySuccess("Password changed successfully!");
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        setSecuritySuccess(null);
      }, 5000);
    } catch (err) {
      setSecurityError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      void navigate({ to: "/login" });
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
        className="space-y-6"
      >
        <Card className="border border-border/60 shadow-xs rounded-3xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <div className="p-2 bg-primary/10 rounded-2xl text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                Change Password
              </CardTitle>
              <CardDescription className="text-xs">
                Update your account password. You will be logged out of other
                devices.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldSet className="space-y-4">
              <FieldGroup className="grid grid-cols-1 gap-4">
                <Controller
                  name="currentPassword"
                  control={passwordForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Current Password
                      </FieldLabel>
                      <PasswordInput
                        {...field}
                        id={field.name}
                        placeholder="••••••••"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "currentPassword-error"
                            : undefined
                        }
                      />
                      <FieldError
                        id="currentPassword-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />

                <Controller
                  name="newPassword"
                  control={passwordForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                      <PasswordInput
                        {...field}
                        id={field.name}
                        placeholder="••••••••"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? "newPassword-error" : undefined
                        }
                      />
                      <FieldError
                        id="newPassword-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />

                <Controller
                  name="confirmPassword"
                  control={passwordForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Confirm New Password
                      </FieldLabel>
                      <PasswordInput
                        {...field}
                        id={field.name}
                        placeholder="••••••••"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid
                            ? "confirmPassword-error"
                            : undefined
                        }
                      />
                      <FieldError
                        id="confirmPassword-error"
                        errors={[fieldState.error]}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </FieldSet>

            {/* Messages & Save Button inside CardContent */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border/40">
              <div className="flex-1">
                <FormErrorMessage message={securityError} />
                {securitySuccess && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold dark:text-emerald-400 bg-emerald-500/10 py-2 px-3 rounded-2xl w-fit animate-in fade-in duration-300">
                    <Check className="size-3.5" />
                    {securitySuccess}
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
                className="cursor-pointer gap-2 px-6 min-w-32 self-end sm:self-auto"
              >
                {passwordForm.formState.isSubmitting ? (
                  <>
                    <Spinner />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Log Out Card */}
      <Card className="border border-destructive/30 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-destructive/10 rounded-2xl text-destructive">
            <LogOut className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-destructive">
              Log Out
            </CardTitle>
            <CardDescription className="text-xs">
              Log out of your account on this device.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={handleLogout}
            className="cursor-pointer gap-2 px-6"
          >
            <LogOut className="size-4" />
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
