"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { loginSchema, type LoginInput } from "@/features/auth/schemas";
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

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = validateCallbackUrl(searchParams.get("callbackUrl"));

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    try {
      // Auth.js v5 native server-side redirect: the 303 is issued AFTER the
      // Set-Cookie header is written, so the next request carries the session
      // cookie natively. This avoids the { redirect: false } + router.push
      // cookie-propagation race (UAT-2).
      await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: true,
        redirectTo: callbackUrl ?? "/dashboard",
      });
    } catch (error) {
      // signIn with redirect:true throws NEXT_REDIRECT on success — re-throw
      if (isRedirectError(error)) throw error;
      toast.error("Incorrect email or password. Please try again.");
    }
  }

  return (
    <Card className="max-w-[400px] w-full">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="text-xl font-semibold">Plant Minder</span>
        </div>
        <h1 className="text-2xl font-semibold">Sign in to your account</h1>
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
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
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
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-2 border-t bg-muted/50 py-4">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent hover:underline font-medium">
            Sign up
          </Link>
        </p>
        <Link
          href="/demo"
          className="text-sm text-accent hover:underline"
        >
          Explore without signing up
        </Link>
      </CardFooter>
    </Card>
  );
}
