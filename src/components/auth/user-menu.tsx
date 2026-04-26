"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CalendarDays, Home, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HouseholdSwitcher } from "@/components/household/household-switcher";

interface UserMenuProps {
  email: string;
  name?: string | null;
  /**
   * D-04 / Plan 07 — Household list rendered in the mobile variant of the
   * HouseholdSwitcher, embedded directly inside this menu's DropdownMenuContent.
   */
  households: Array<{
    household: { id: string; slug: string; name: string };
    role: "OWNER" | "MEMBER";
    isDefault: boolean;
  }>;
  currentSlug: string;
  currentHouseholdName: string;
}

function getInitials(email: string, name?: string | null): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

export function UserMenu({
  email,
  name,
  households,
  currentSlug,
  currentHouseholdName,
}: UserMenuProps) {
  const router = useRouter();
  const initials = getInitials(email, name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu"
        render={
          <button className="flex h-8 w-8 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground hover:bg-accent/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
        }
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* D-04: mobile HouseholdSwitcher — rows for each other household +
            "Make default" affordance. Returns a fragment so it slots straight
            into this DropdownMenuContent without an extra wrapper. */}
        <HouseholdSwitcher
          variant="mobile"
          households={households}
          currentSlug={currentSlug}
          currentHouseholdName={currentHouseholdName}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`/h/${currentSlug}/settings`)}
          className="cursor-pointer gap-2"
        >
          <Home className="h-4 w-4" />
          Household settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/h/${currentSlug}/availability`)}
          className="cursor-pointer gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Availability settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/preferences")}
          className="cursor-pointer gap-2"
        >
          <Settings className="h-4 w-4" />
          Account preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="cursor-pointer gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
