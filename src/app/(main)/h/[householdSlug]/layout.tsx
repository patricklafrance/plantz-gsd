import { getCurrentHousehold } from "@/features/household/context";

/**
 * D-03 chokepoint. Resolves the slug → household + membership once per request
 * via React cache(); nested pages reuse the cached result. Throws ForbiddenError
 * (caught by error.tsx) for non-members and notFound() (caught by not-found.tsx)
 * for unknown slugs.
 *
 * Chrome (header + NotificationBell + BottomTabBar) is rendered by the OUTER
 * `(main)/layout.tsx` during Plans 03a + 03b. Plan 03c moves it inward to this
 * layout so the chrome is household-aware (reminder count uses household.id).
 */
export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdSlug: string }>;
}) {
  const { householdSlug } = await params;
  await getCurrentHousehold(householdSlug);
  return <>{children}</>;
}
