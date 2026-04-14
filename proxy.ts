export { auth as proxy } from "./auth";

export const config = {
  matcher: [
    // Protect all routes except: api, static files, auth pages, favicon
    "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
};
