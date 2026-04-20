import { startDemoSession } from "@/features/demo/actions";
import { redirect } from "next/navigation";

/**
 * GET /demo — Demo entry point as a Route Handler.
 *
 * Using a Route Handler (instead of a Client Component + useEffect + Server Action)
 * avoids a race between the NextAuth signIn cookie write and the client-side router
 * navigation that caused a stale-cache 404 after sign-out.
 *
 * Flow:
 *   Browser GET /demo (hard navigation from <a href="/demo">)
 *   → Route Handler seeds demo user + signs in via startDemoSession()
 *   → signIn() sets session cookie + throws NEXT_REDIRECT("/dashboard")
 *   → Next.js converts NEXT_REDIRECT to HTTP 302
 *   → Browser follows redirect to /dashboard (hard nav, bypasses router cache)
 *   → LegacyDashboardPage resolves demo slug → 302 to /h/[slug]/dashboard
 *   → Dashboard renders correctly
 *
 * On error: redirect to /login with an error query param so the login form
 * can surface a toast (future work — for now the param is available).
 */
export async function GET() {
  const result = await startDemoSession();

  // startDemoSession() redirects (throws NEXT_REDIRECT) on success —
  // if we reach this line, it returned an error object instead.
  if (result?.error) {
    redirect("/login?error=demo_failed");
  }

  // Fallback: should not be reached if startDemoSession works correctly.
  redirect("/login");
}
