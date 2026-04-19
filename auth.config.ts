import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/login", "/register", "/demo"];
      // /join/* is public BUT must not redirect logged-in users away (D-21):
      // logged-in users need to reach the confirm-join screen.
      const noRedirectPublicPaths = ["/join"];

      const isPublicRoute = publicPaths.some(
        (path) =>
          nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
      );
      const isNoRedirectPublic = noRedirectPublicPaths.some(
        (path) =>
          nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
      );

      // Check carve-out BEFORE the logged-in redirect branch (Pitfall 2).
      if (isNoRedirectPublic) {
        return true;
      }

      if (isPublicRoute) {
        // Redirect logged-in users away from auth pages to dashboard
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // All other routes require authentication
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
