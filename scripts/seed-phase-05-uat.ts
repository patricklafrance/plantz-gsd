/**
 * Phase 5 UAT seed — idempotent. Produces a testable household state so the
 * dashboard banners + unified NotificationBell + mark-read surfaces have real
 * data to render against.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts [state]
 *
 * States (default: cycle-start):
 *   cycle-start   — demo user is assignee, unread `cycle_started` → CycleStartBanner
 *   reassignment  — demo user is assignee, unread `cycle_reassigned_manual_skip` → ReassignmentBanner
 *   passive       — partner user is assignee, demo user is viewer (non-assignee) → PassiveStatusBanner
 *   fallback      — cycle.status=paused + unread `cycle_fallback_owner` → FallbackBanner
 *   reset         — wipe all Phase-5-created rows but leave users + household
 *
 * Always prints:
 *   Household slug       → for http://localhost:3000/h/{slug}/dashboard
 *   Demo user id + email → who to log in as (always demo@plantminder.app)
 *   Cycle id + assignee  → which member currently holds the cycle
 *   Notifications        → what notification rows are unread for which recipient
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays } from "date-fns";
import bcryptjs from "bcryptjs";
import { DEMO_EMAIL } from "../src/features/demo/seed-data";

const PARTNER_EMAIL = "partner@plantminder.app";
const PARTNER_PASSWORD = "partner-password-not-secret";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

type State =
  | "cycle-start"
  | "reassignment"
  | "reassignment-partner"
  | "passive"
  | "fallback"
  | "fallback-partner"
  | "reset";

async function main() {
  const state = (process.argv[2] ?? "cycle-start") as State;
  const validStates: State[] = [
    "cycle-start",
    "reassignment",
    "reassignment-partner",
    "passive",
    "fallback",
    "fallback-partner",
    "reset",
  ];
  if (!validStates.includes(state)) {
    console.error(`Invalid state: ${state}. Valid: ${validStates.join(", ")}`);
    process.exit(1);
  }

  const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!demo) {
    console.error("Demo user not found. Run `node --env-file=.env.local --import tsx prisma/seed.ts` first.");
    process.exit(1);
  }

  const household = await db.household.findFirst({
    where: { members: { some: { userId: demo.id, role: "OWNER" } } },
  });
  if (!household) {
    console.error("Demo household not found — demo user has no OWNER membership.");
    process.exit(1);
  }

  let partner = await db.user.findUnique({ where: { email: PARTNER_EMAIL } });
  if (!partner) {
    const passwordHash = await bcryptjs.hash(PARTNER_PASSWORD, 12);
    partner = await db.user.create({
      data: {
        email: PARTNER_EMAIL,
        passwordHash,
        name: "Partner User",
        onboardingCompleted: true,
        remindersEnabled: true,
      },
    });
    console.log(`Created partner user: ${partner.email}`);
  }

  await db.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: partner.id } },
    update: { rotationOrder: 1 },
    create: {
      householdId: household.id,
      userId: partner.id,
      role: "MEMBER",
      rotationOrder: 1,
      isDefault: false,
    },
  });

  await db.householdNotification.deleteMany({ where: { householdId: household.id } });
  await db.cycle.deleteMany({ where: { householdId: household.id } });

  if (state === "reset") {
    console.log("RESET: removed all Phase-5 notifications and cycles for household.");
    await db.$disconnect();
    return;
  }

  const now = new Date();
  const startDate = now;
  const endDate = addDays(now, household.cycleDuration);

  const memberOrderSnapshot = [
    { userId: demo.id, rotationOrder: 0 },
    { userId: partner.id, rotationOrder: 1 },
  ];

  let cycleAssignee = demo.id;
  let cycleStatus: "active" | "paused" = "active";
  let notificationType = "cycle_started";
  let notificationRecipient = demo.id;
  let notificationPriorAssignee: string | null = null;

  switch (state) {
    case "cycle-start":
      cycleAssignee = demo.id;
      cycleStatus = "active";
      notificationType = "cycle_started";
      notificationRecipient = demo.id;
      break;
    case "reassignment":
      cycleAssignee = demo.id;
      cycleStatus = "active";
      notificationType = "cycle_reassigned_manual_skip";
      notificationRecipient = demo.id;
      notificationPriorAssignee = partner.id;
      break;
    case "reassignment-partner":
      cycleAssignee = partner.id;
      cycleStatus = "active";
      notificationType = "cycle_reassigned_manual_skip";
      notificationRecipient = partner.id;
      notificationPriorAssignee = demo.id;
      break;
    case "passive":
      cycleAssignee = partner.id;
      cycleStatus = "active";
      notificationType = "cycle_started";
      notificationRecipient = partner.id;
      break;
    case "fallback":
      cycleAssignee = demo.id;
      cycleStatus = "paused";
      notificationType = "cycle_fallback_owner";
      notificationRecipient = demo.id;
      break;
    case "fallback-partner":
      cycleAssignee = partner.id;
      cycleStatus = "paused";
      notificationType = "cycle_fallback_owner";
      notificationRecipient = partner.id;
      break;
  }

  const cycle = await db.cycle.create({
    data: {
      householdId: household.id,
      cycleNumber: 1,
      anchorDate: startDate,
      cycleDuration: household.cycleDuration,
      startDate,
      endDate,
      status: cycleStatus,
      transitionReason: (state === "fallback" || state === "fallback-partner") ? "all_unavailable_fallback" : null,
      assignedUserId: cycleAssignee,
      memberOrderSnapshot,
    },
  });

  await db.householdNotification.create({
    data: {
      householdId: household.id,
      recipientUserId: notificationRecipient,
      type: notificationType,
      cycleId: cycle.id,
      readAt: null,
      priorAssigneeUserId: notificationPriorAssignee,
    },
  });

  console.log("\n=== Phase 5 UAT seed applied ===");
  console.log(`State:         ${state}`);
  console.log(`Household:     ${household.name} (${household.slug})`);
  console.log(`Dashboard URL: http://localhost:3000/h/${household.slug}/dashboard`);
  console.log(`Demo user:     ${demo.email} (id: ${demo.id})`);
  console.log(`Partner user:  ${partner.email} (id: ${partner.id})`);
  console.log(`Cycle:         status=${cycleStatus} assigneeId=${cycleAssignee}`);
  console.log(`Notification:  type=${notificationType} recipientId=${notificationRecipient} unread`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
