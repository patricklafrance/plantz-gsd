"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newEmail: z.email("Please enter a valid email."),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

interface AccountSettingsProps {
  userEmail: string;
  isDemo?: boolean;
}

export function AccountSettings({ userEmail, isDemo }: AccountSettingsProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const emailForm = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { currentPassword: "", newEmail: "" },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onEmailSubmit(_values: ChangeEmailInput) {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }
    // Server Action call — to be implemented in Phase 7 or later
    // For now, the form validates and shows a toast
    toast.info("Email update is not yet available.");
    emailForm.reset();
  }

  async function onPasswordSubmit(_values: ChangePasswordInput) {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }
    // Server Action call — to be implemented in Phase 7 or later
    toast.info("Password update is not yet available.");
    passwordForm.reset();
  }

  async function handleDeleteAccount() {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }
    setIsDeleting(true);
    // Server Action call — to be implemented in Phase 7 or later
    toast.info("Account deletion is not yet available.");
    setIsDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* Change Email */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Email address</h3>
        <p className="text-xs text-muted-foreground">Current: {userEmail}</p>
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            className="space-y-3"
          >
            <FormField
              control={emailForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      disabled={!!isDemo}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={emailForm.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      disabled={!!isDemo}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={emailForm.formState.isSubmitting || !!isDemo}
            >
              {emailForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update email"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <Separator />

      {/* Change Password */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Password</h3>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="space-y-3"
          >
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      disabled={!!isDemo}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      disabled={!!isDemo}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      disabled={!!isDemo}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={passwordForm.formState.isSubmitting || !!isDemo}
            >
              {passwordForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <Separator />

      {/* Delete Account */}
      <div className="space-y-3">
        <AlertDialog>
          <AlertDialogTrigger
            disabled={!!isDemo}
            render={
              <button
                className={buttonVariants({
                  variant: "destructive",
                  size: "sm",
                })}
              />
            }
          >
            Delete account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your plants, watering history,
                and notes. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
