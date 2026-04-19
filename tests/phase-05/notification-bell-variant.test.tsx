import { describe, it, vi } from "vitest";

vi.mock("@/features/household/actions", () => ({
  markNotificationsRead: vi.fn(),
}));

describe("NotificationBell variant + merged feed (D-17, D-18, D-20, D-22)", () => {
  it.todo("variant='desktop' trigger uses ghost icon button shape");
  it.todo(
    "variant='mobile' trigger uses flex-1 column with 'Alerts' label + min-h-[44px]",
  );
  it.todo(
    "HNTF-01 badge renders count > 0 with bg-accent text-accent-foreground (both variants harmonized)",
  );
  it.todo(
    "HNTF-01 badge shows '99+' when count > 99 (both variants harmonized)",
  );
  it.todo(
    "HNTF-01 aria-label is '{count} notifications' when count > 0, else 'No new notifications'",
  );
  it.todo(
    "HNTF-02/03 merged feed order: overdue → due-today → unread cycle events → read cycle events",
  );
  it.todo("HNTF-03 unread cycle event has border-l-2 border-accent stripe");
  it.todo(
    "HNTF-03 read cycle event has opacity/text-muted-foreground styling",
  );
  it.todo(
    "HNTF-01 DropdownMenu.onOpenChange(true) + unreadIds.length > 0 → startTransition(() => markNotificationsRead({ householdId, notificationIds }))",
  );
  it.todo(
    "HNTF-01 onOpenChange(true) + empty unreadIds → markNotificationsRead NOT called",
  );
  it.todo(
    "HNTF-01 onOpenChange(false) → markNotificationsRead NOT called (close is not a trigger)",
  );
});
