"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { registerSchema, type RegisterInput } from "@/features/auth/schemas";
import { registerUser } from "@/features/auth/actions";
import { validateCallbackUrl } from "@/features/auth/callback-url";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = validateCallbackUrl(searchParams.get("callbackUrl"));

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterInput) {
    // D-12: pass browser-detected timezone to seed the auto-created household
    let detectedTimezone: string | undefined;
    try {
      detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      detectedTimezone = undefined; // server defaults to UTC
    }

    const result = await registerUser({
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      timezone: detectedTimezone,
      callbackUrl: callbackUrl ?? undefined,
    });

    // If registerUser returns (didn't throw redirect), it means there was an error
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    // The normal success path: registerUser calls signIn which throws NEXT_REDIRECT
    // The redirect is handled by Next.js automatically — the client navigates to /dashboard
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card className="max-w-[400px] w-full">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="text-xl font-semibold">Plant Minder</span>
        </div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        className="pr-11"
                        disabled={isSubmitting}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={isSubmitting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        className="pr-11"
                        disabled={isSubmitting}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center border-t bg-muted/50 py-4">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
