import "dotenv/config";
import { db } from "../src/lib/db";
import { generateInvitationToken } from "../src/lib/crypto";

const HOUSEHOLD_ID = "cmo4jjvw90001a8na6n91fow7";
const OWNER_USER_ID = "cmo4jjvu70000a8nahmnilwk9";

async function main() {
  const { rawToken, tokenHash } = generateInvitationToken();
  const invite = await db.invitation.create({
    data: {
      householdId: HOUSEHOLD_ID,
      tokenHash,
      invitedByUserId: OWNER_USER_ID,
    },
    select: { id: true },
  });
  console.log(`invitationId: ${invite.id}`);
  console.log(`rawToken: ${rawToken}`);
  console.log(`URL: http://localhost:3000/join/${rawToken}`);
  await db.$disconnect();
}

main();
