import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { z } from "zod/v4";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { DEMO_EMAIL } from "@/features/demo/seed-data";

export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Check if this is the demo user by email lookup
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { email: true },
        });
        token.isDemo = dbUser?.email === DEMO_EMAIL;
        // D-13: Resolve activeHouseholdId at sign-in only.
        // Per Pitfall 4, this query MUST stay inside `if (user)` so it runs once per
        // sign-in, not on every request. Per D-14 the value is a landing-target hint
        // only — Plan 04's requireHouseholdAccess() guard is the authorization source.
        const membership = await db.householdMember.findFirst({
          where: { userId: user.id },
          select: { householdId: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        });
        token.activeHouseholdId = membership?.householdId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        session.user.isDemo = token.isDemo === true;
        session.user.activeHouseholdId =
          typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordsMatch = await bcryptjs.compare(
          password,
          user.passwordHash,
        );
        if (!passwordsMatch) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
