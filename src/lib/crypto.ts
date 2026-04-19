/**
 * Invitation token generation + hashing (Phase 4, D-01).
 *
 * `generateInvitationToken` produces 256 bits of CSPRNG entropy as a 64-char hex
 * rawToken; the returned `tokenHash` is the SHA-256 hex digest of that rawToken.
 * Only `tokenHash` is persisted (Invitation.tokenHash @unique); the raw token is
 * returned to the caller once and composed into the shareable URL:
 *   https://<host>/join/<rawToken>
 *
 * `hashInvitationToken` is the symmetric lookup helper used by acceptInvitation
 * and resolveInvitationByToken — hash the raw URL segment, then DB-lookup by hash.
 *
 * Pitfall 10 §1 binding: never hand-roll CSPRNG; never store the raw token.
 */
import { randomBytes, createHash } from "node:crypto";

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
