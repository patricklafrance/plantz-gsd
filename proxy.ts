export { auth as proxy } from "./auth";

export const config = {
  matcher: [
    // Protect all routes except: NextAuth API, static files, auth pages, favicon
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)",
  ],
};
