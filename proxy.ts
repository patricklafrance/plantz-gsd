export { auth as proxy } from "./auth";

export const config = {
  matcher: [
    // Protect all routes except: NextAuth API, cron webhooks, static files, auth pages, favicon
    // api/cron: bearer-auth route handlers must bypass NextAuth session middleware (Phase 3 Pitfall A)
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo).*)",
  ],
};
