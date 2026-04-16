import { auth } from "../../../auth";
import { db } from "@/lib/db";

/**
 * D-19: 403 Forbidden — distinct from 404 NotFound.
 * Per RESEARCH Pitfall 3, Object.setPrototypeOf is required so that
 * `instanceof ForbiddenError` works across compilation-unit boundaries
 * (e.g. when error.tsx checks `error instanceof ForbiddenError`).
 */
export class ForbiddenError extends Error {
  readonly name = "ForbiddenError" as const;
  readonly statusCode = 403 as const;

  constructor(message = "Access denied") {
    super(message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * D-16/D-17/D-18/D-20: Live membership check for household-scoped Server Actions
 * and Server Components. Caller must resolve householdId explicitly (typically
 * from URL slug via resolveHouseholdBySlug). NEVER trusts JWT activeHouseholdId
 * for authorization — Pitfall 16. The findFirst hits the
 * @@unique([householdId, userId]) index added in Plan 02 schema.
 *
 * @param householdId - The household to check membership against.
 * @returns The household row, the member row, and the narrowed role.
 * @throws ForbiddenError if the session is missing or the user is not a member.
 */
export async function requireHouseholdAccess(householdId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ForbiddenError("Not authenticated");
  }

  const member = await db.householdMember.findFirst({
    where: { householdId, userId: session.user.id },
    include: { household: true },
  });

  if (!member) {
    throw new ForbiddenError("Not a member of this household");
  }

  return {
    household: member.household,
    member,
    role: member.role as "OWNER" | "MEMBER",
  };
}
