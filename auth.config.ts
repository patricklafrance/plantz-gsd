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
      const isPublicRoute = publicPaths.some(
        (path) =>
          nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
      );

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
