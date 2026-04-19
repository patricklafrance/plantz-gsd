import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Mock markNotificationsRead Server Action so we can assert on calls.
vi.mock("@/features/household/actions", () => ({
  markNotificationsRead: vi.fn(),
}));

// Mock next/navigation router — NotificationBell uses useRouter().push() for
// plant reminder row navigation; tests don't exercise the push but need the hook.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the DropdownMenu primitive so we can drive onOpenChange directly
// without needing @testing-library/user-event + base-ui's real portal/keyboard
// flow. The mock renders children inline and exposes onOpenChange via two
// test-only buttons ("open-mock" / "close-mock"). This lets us assert the
// D-20 onOpenChange(true/false) branches deterministically.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dropdown-root">
      <button
        type="button"
        data-testid="open-mock"
        onClick={() => onOpenChange?.(true)}
      >
        open-mock
      </button>
      <button
        type="button"
        data-testid="close-mock"
        onClick={() => onOpenChange?.(false)}
      >
        close-mock
      </button>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ render }: { render: React.ReactElement }) => render,
  DropdownMenuContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dropdown-content" className={className}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <div
      data-testid="dropdown-item"
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  ),
}));

import { NotificationBell } from "@/components/reminders/notification-bell";
import { markNotificationsRead } from "@/features/household/actions";
import type { ReminderItem, CycleEventItem } from "@/features/reminders/types";

describe("NotificationBell variant + merged feed (D-17, D-18, D-20, D-22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    householdId: "ckhh1",
    householdSlug: "acme",
    count: 2,
    reminderItems: [] as ReminderItem[],
    cycleEvents: [] as CycleEventItem[],
  };

  it("variant='desktop' trigger uses ghost icon button shape", () => {
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={1}
        cycleEvents={[]}
      />,
    );
    const trigger = screen.getByRole("button", { name: /notifications/i });
    expect(trigger.className).toMatch(/p-2\.5/);
  });

  it("variant='mobile' trigger uses flex-1 column with 'Alerts' label + min-h-[44px]", () => {
    render(
      <NotificationBell
        {...baseProps}
        variant="mobile"
        count={1}
        cycleEvents={[]}
      />,
    );
    const trigger = screen.getByRole("button", { name: /notifications/i });
    expect(trigger.className).toMatch(/min-h-\[44px\]/);
    expect(trigger.textContent).toMatch(/Alerts/);
  });

  it("HNTF-01 badge renders count > 0 with bg-accent text-accent-foreground (both variants harmonized)", () => {
    const { container: desktop } = render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={3}
        cycleEvents={[]}
      />,
    );
    const desktopBadge = desktop.querySelector(".bg-accent");
    expect(desktopBadge).not.toBeNull();
    expect(desktopBadge?.className).toMatch(/text-accent-foreground/);

    cleanup();

    const { container: mobile } = render(
      <NotificationBell
        {...baseProps}
        variant="mobile"
        count={3}
        cycleEvents={[]}
      />,
    );
    const mobileBadge = mobile.querySelector(".bg-accent");
    expect(mobileBadge).not.toBeNull();
    expect(mobileBadge?.className).toMatch(/text-accent-foreground/);
  });

  it("HNTF-01 badge shows '99+' when count > 99 (both variants harmonized — D-19 mobile '9+' regression eliminated)", () => {
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={150}
        cycleEvents={[]}
      />,
    );
    expect(screen.getByText("99+")).not.toBeNull();

    cleanup();

    render(
      <NotificationBell
        {...baseProps}
        variant="mobile"
        count={150}
        cycleEvents={[]}
      />,
    );
    expect(screen.getByText("99+")).not.toBeNull();
  });

  it("HNTF-01 aria-label is '{count} notifications' when count > 0, else 'No new notifications'", () => {
    const { rerender } = render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={5}
        cycleEvents={[]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "5 notifications" }),
    ).not.toBeNull();

    rerender(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={0}
        cycleEvents={[]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "No new notifications" }),
    ).not.toBeNull();
  });

  it("HNTF-02/03 merged feed order: overdue → due-today → unread cycle events → read cycle events", () => {
    const reminderItems: ReminderItem[] = [
      {
        plantId: "p-due",
        nickname: "Due Today Fern",
        roomName: "Kitchen",
        statusLabel: "Due today",
        daysOverdue: 0,
      },
      {
        plantId: "p-over",
        nickname: "Overdue Palm",
        roomName: "Den",
        statusLabel: "Overdue 2d",
        daysOverdue: 2,
      },
    ];
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "n-read",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 10),
        readAt: new Date(2026, 3, 11),
        priorAssigneeName: null,
      },
      {
        notificationId: "n-unread",
        type: "cycle_reassigned_manual_skip",
        createdAt: new Date(2026, 3, 15),
        readAt: null,
        priorAssigneeName: "Alex",
      },
    ];

    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={4}
        reminderItems={reminderItems}
        cycleEvents={cycleEvents}
      />,
    );

    const items = screen.getAllByTestId("dropdown-item");
    // 2 reminders + 1 unread event + 1 read event = 4 items
    expect(items).toHaveLength(4);
    // Order assertion via textContent:
    // [0] overdue (daysOverdue > 0)
    expect(items[0].textContent).toMatch(/Overdue Palm/);
    // [1] due-today
    expect(items[1].textContent).toMatch(/Due Today Fern/);
    // [2] unread cycle event
    expect(items[2].textContent).toMatch(/Alex/);
    // [3] read cycle event
    expect(items[3].textContent).toMatch(/You're up this cycle/);
  });

  it("HNTF-03 unread cycle event has border-l-2 border-accent stripe", () => {
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "n-unread",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 15),
        readAt: null,
        priorAssigneeName: null,
      },
    ];
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={1}
        cycleEvents={cycleEvents}
      />,
    );
    const item = screen.getByTestId("dropdown-item");
    expect(item.className).toMatch(/border-l-2/);
    expect(item.className).toMatch(/border-accent/);
  });

  it("HNTF-03 read cycle event has opacity/text-muted-foreground styling", () => {
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "n-read",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 10),
        readAt: new Date(2026, 3, 11),
        priorAssigneeName: null,
      },
    ];
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={0}
        cycleEvents={cycleEvents}
      />,
    );
    const item = screen.getByTestId("dropdown-item");
    expect(item.className).toMatch(/opacity-60/);
  });

  it("HNTF-01 DropdownMenu.onOpenChange(true) + unreadIds.length > 0 → startTransition(() => markNotificationsRead({ householdId, notificationIds }))", () => {
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "ckn1",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 15),
        readAt: null,
        priorAssigneeName: null,
      },
      {
        notificationId: "ckn2",
        type: "cycle_reassigned_manual_skip",
        createdAt: new Date(2026, 3, 14),
        readAt: null,
        priorAssigneeName: "Alex",
      },
    ];
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={2}
        cycleEvents={cycleEvents}
      />,
    );

    fireEvent.click(screen.getByTestId("open-mock"));

    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
    expect(markNotificationsRead).toHaveBeenCalledWith({
      householdId: "ckhh1",
      householdSlug: "acme",
      notificationIds: ["ckn1", "ckn2"],
    });
  });

  it("HNTF-01 onOpenChange(true) + empty unreadIds → markNotificationsRead NOT called", () => {
    // All cycleEvents already read
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "n-read",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 10),
        readAt: new Date(2026, 3, 11),
        priorAssigneeName: null,
      },
    ];
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={0}
        cycleEvents={cycleEvents}
      />,
    );

    fireEvent.click(screen.getByTestId("open-mock"));

    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("HNTF-01 onOpenChange(false) → markNotificationsRead NOT called (close is not a trigger)", () => {
    const cycleEvents: CycleEventItem[] = [
      {
        notificationId: "ckn1",
        type: "cycle_started",
        createdAt: new Date(2026, 3, 15),
        readAt: null,
        priorAssigneeName: null,
      },
    ];
    render(
      <NotificationBell
        {...baseProps}
        variant="desktop"
        count={1}
        cycleEvents={cycleEvents}
      />,
    );

    // Open first (should fire once)
    fireEvent.click(screen.getByTestId("open-mock"));
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);

    // Close — must NOT fire
    fireEvent.click(screen.getByTestId("close-mock"));
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
  });
});
