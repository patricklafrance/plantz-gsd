"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { format as formatDate } from "date-fns";
import { generateHouseholdSlug } from "@/lib/slug";
import {
  createHouseholdSchema,
  createAvailabilitySchema,
  deleteAvailabilitySchema,
  skipCurrentCycleSchema,
} from "./schema";
import { computeInitialCycleBoundaries, transitionCycle } from "./cycle";
import { findOverlappingPeriod } from "./availability";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { HOUSEHOLD_PATHS } from "./paths";

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

    // WR-01: single source of truth for the new household's cycle duration +
    // timezone. Passed to both household.create and computeInitialCycleBoundaries
    // so a future edit cannot desync Cycle #1's boundaries from the household row.
    const cycleDuration = 7;
    const cycleTimezone = parsed.data.timezone ?? "UTC";

    const created = await tx.household.create({
      data: {
        name: parsed.data.name,
        slug,
        timezone: cycleTimezone,
        cycleDuration,
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
    const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
      new Date(),
      cycleTimezone,
      cycleDuration,
    );
    await tx.cycle.create({
      data: {
        householdId: created.id,
        cycleNumber: 1,
        anchorDate,
        cycleDuration,
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

/**
 * AVLB-04 / D-14: active assignee manually skips their current cycle.
 * 7-step template. Only the current assignee may call this.
 */
export async function skipCurrentCycle(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = skipCurrentCycleSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access check
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: load current cycle and assert caller is the assignee
  const currentCycle = await db.cycle.findFirst({
    where: {
      householdId: parsed.data.householdId,
      status: { in: ["active", "paused"] },
    },
    orderBy: { cycleNumber: "desc" },
    select: { id: true, assignedUserId: true, status: true },
  });
  if (!currentCycle) {
    return { error: "No active cycle found for this household." };
  }
  if (currentCycle.assignedUserId !== session.user.id) {
    return { error: "Only the active assignee can skip this cycle." };
  }

  // Step 6: shared transition function (manual_skip). This is the single
  // cycle-mutation path — we do NOT touch Cycle rows directly here.
  await transitionCycle(parsed.data.householdId, "manual_skip");

  // Step 7: revalidate dashboard so the clicking user sees the new banner immediately.
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true };
}

/**
 * AVLB-01 / D-06 / Pitfall 11 + 12: create an availability period.
 * 7-step template with overlap precheck.
 */
export async function createAvailability(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse (refinements enforce startDate >= today + endDate > startDate)
  const parsed = createAvailabilitySchema.safeParse(data);
  if (!parsed.success) {
    // WR-03: only surface messages we authored via `.refine()` on the date
    // fields. For base parse errors (cuid, min-length, etc.) return the
    // generic message to avoid leaking internal Zod wording.
    const firstIssue = parsed.error.issues[0];
    const isDateRefinement =
      firstIssue?.path[0] === "startDate" || firstIssue?.path[0] === "endDate";
    return {
      error: isDateRefinement && firstIssue?.message
        ? firstIssue.message
        : "Invalid input.",
    };
  }

  // Step 4: live household access check
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: D-06 overlap precheck — reject if this caller already has an
  // availability period intersecting the requested range.
  const overlap = await findOverlappingPeriod(
    session.user.id,
    parsed.data.householdId,
    parsed.data.startDate,
    parsed.data.endDate,
  );
  if (overlap) {
    const s = formatDate(overlap.startDate, "MMM d, yyyy");
    const e = formatDate(overlap.endDate, "MMM d, yyyy");
    return {
      error: `You already have an availability period covering those dates (${s} → ${e}). Delete it first, or pick non-overlapping dates.`,
    };
  }

  // Step 6: insert
  await db.availability.create({
    data: {
      userId: session.user.id,
      householdId: parsed.data.householdId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason ?? null,
    },
  });

  // Step 7: revalidate the settings page so the new row appears.
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true };
}

/**
 * AVLB-02 / D-07 / D-09: delete availability; owning member OR household owner.
 */
export async function deleteAvailability(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = deleteAvailabilitySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4+5: fetch row (needed to resolve householdId), then live access +
  // D-09 dual-auth (row.userId === session.user.id || role === "OWNER").
  const row = await db.availability.findUnique({
    where: { id: parsed.data.availabilityId },
    select: { id: true, userId: true, householdId: true },
  });
  if (!row) return { error: "Availability period not found." };

  try {
    const { role } = await requireHouseholdAccess(row.householdId);
    // D-09: owning member OR household owner
    if (row.userId !== session.user.id && role !== "OWNER") {
      throw new ForbiddenError(
        "You can only delete your own availability periods.",
      );
    }
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 6: delete
  await db.availability.delete({ where: { id: row.id } });

  // Step 7: revalidate settings
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true };
}
