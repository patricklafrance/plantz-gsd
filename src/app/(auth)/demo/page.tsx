import { startDemoSession } from "@/features/demo/actions";

export default async function DemoPage() {
  // startDemoSession calls signIn("credentials", ...) which throws NEXT_REDIRECT
  // The user will be redirected to /dashboard automatically
  await startDemoSession();

  // Fallback UI — only shown if startDemoSession returns an error instead of redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Starting demo...
        </p>
        <p className="text-xs text-muted-foreground">
          If you are not redirected,{" "}
          <a href="/login" className="text-accent hover:underline">
            return to login
          </a>
          .
        </p>
      </div>
    </div>
  );
}
