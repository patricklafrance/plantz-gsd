"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { generateHouseholdSlug } from "@/lib/slug";
import { createHouseholdSchema } from "./schema";
import { computeInitialCycleBoundaries } from "./cycle";

/**
 * HSLD-02 (D-06): Create a secondary household, atomically inserting the
 * Household row and an OWNER HouseholdMember for the current user.
 *
 * Per D-04 / Pitfall 16 note: this action does NOT call requireHouseholdAccess
 * — creating a new household is by definition not action on an EXISTING household,
 * so there is no membership to verify. Session + demo gate + Zod parse are the
 * only precondition checks; the $transaction is atomic.
 *
 * Slug generation mirrors src/features/auth/actions.ts:54-66 — bounded
 * collision loop at 10 attempts with DB unique-constraint as final guard.
 */
export async function createHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (unchanged from v1 pattern)
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = createHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const userId = session.user.id;

  // Step 4 (skipped — see JSDoc)
  // Step 5 + 6: $transaction — slug loop + household.create + member.create(OWNER, isDefault: false)
  const household = await db.$transaction(async (tx) => {
    let slug: string;
    let attempts = 0;
    while (true) {
      slug = generateHouseholdSlug();
      const existing = await tx.household.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) break;
      // WR-02: throw after 10 total attempts — previously ran 11 iterations
      // before throwing, which contradicted the "after 10 attempts" message.
      if (attempts++ >= 9) {
        throw new Error("Slug generation failed after 10 attempts");
      }
    }

    const created = await tx.household.create({
      data: {
        name: parsed.data.name,
        slug,
        timezone: parsed.data.timezone ?? "UTC",
        cycleDuration: 7,
        rotationStrategy: "sequential",
      },
    });

    await tx.householdMember.create({
      data: {
        userId,
        householdId: created.id,
        role: "OWNER",
        rotationOrder: 0,
        isDefault: false, // secondary household — does not override existing default
      },
    });

    // D-01: Cycle #1 eager creation. Every household always has an active cycle.
    const cycleTimezone = parsed.data.timezone ?? "UTC";
    const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
      new Date(),
      cycleTimezone,
      7, // must match created.cycleDuration above
    );
    await tx.cycle.create({
      data: {
        householdId: created.id,
        cycleNumber: 1,
        anchorDate,
        cycleDuration: 7,
        startDate,
        endDate,
        status: "active",
        assignedUserId: userId,
        memberOrderSnapshot: [{ userId, rotationOrder: 0 }],
      },
    });

    return created;
  });

  // Step 7: no revalidatePath — Phase 2 has no UI consumer (D-07). Phase 6's
  // settings form will revalidate its own path from the form action's route.
  return { success: true, household };
}
