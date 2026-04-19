export { auth as proxy } from "./auth";

export const config = {
  matcher: [
    // Protect all routes except: NextAuth API, cron webhooks, static files, auth pages, favicon, join
    // api/cron: bearer-auth route handlers must bypass NextAuth session middleware (Phase 3 Pitfall A)
    // join: public invitation-accept route; bypasses session middleware so logged-out visitors can reach it (Phase 4 D-21, Pitfall 3)
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo|join).*)",
  ],
};
