"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";

import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { validateCallbackUrl } from "@/features/auth/callback-url";
import { loginUser } from "@/features/auth/actions";
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = validateCallbackUrl(searchParams.get("callbackUrl"));
  const errorParam = searchParams.get("error");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitError(null);
    // Server action pre-resolves the user's default household slug and
    // redirects directly to /h/{slug}/dashboard — avoids the /dashboard
    // intermediate redirect flicker. The success branch throws NEXT_REDIRECT
    // (re-thrown internally) and never returns; the failure branch returns
    // a generic { error } message we render inline.
    const result = await loginUser({
      email: values.email,
      password: values.password,
      callbackUrl: callbackUrl ?? undefined,
    });
    if (result?.error) {
      setSubmitError(result.error);
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
        {errorParam === "demo_failed" && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            Couldn&apos;t start the demo session — the demo data is missing.
            Run <code className="font-mono">npx prisma db seed</code> to set
            it up, then try again.
          </div>
        )}
        {submitError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {submitError}
          </div>
        )}
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
        {/*
          Hard navigation (<a> not <Link>) so the browser issues a fresh GET
          to /demo. This is a Route Handler — it runs startDemoSession() server-side,
          sets the session cookie, and issues an HTTP 302 to /dashboard.
          Using <a> bypasses the Next.js client-side router cache, which could
          otherwise serve a stale redirect to a previous session's household slug
          and produce a "page not found" on first load (UAT gap: signout-demo-404).
        */}
        <a
          href="/demo"
          className="text-sm text-accent hover:underline"
        >
          Explore without signing up
        </a>
      </CardFooter>
    </Card>
  );
}
