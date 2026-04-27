"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CalendarDays, Home, LogOut, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { ThemeToggleInline } from "@/components/theme-toggle-inline";

interface UserMenuProps {
  email: string;
  name?: string | null;
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

/**
 * Phase 8 ribbon refresh — three logical groups in one dropdown:
 *   1. My households (HouseholdSwitcher mobile fragment)
 *   2. Settings → Household / Availabilities / Account (renamed from
 *      "Account preferences"; the route is still /preferences)
 *   3. Appearance (inline theme toggle)
 * followed by Sign out.
 */
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

        {/* 1. My households */}
        <HouseholdSwitcher
          variant="mobile"
          households={households}
          currentSlug={currentSlug}
          currentHouseholdName={currentHouseholdName}
        />
        <DropdownMenuSeparator />

        {/* 2. Settings group */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Settings
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => router.push(`/h/${currentSlug}/household-settings`)}
          className="cursor-pointer gap-2"
        >
          <Home className="h-4 w-4" />
          Household
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/h/${currentSlug}/availability-settings`)}
          className="cursor-pointer gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Availabilities
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/h/${currentSlug}/preferences`)}
          className="cursor-pointer gap-2"
        >
          <UserCog className="h-4 w-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 3. Appearance — inline theme toggle, no nav. */}
        <ThemeToggleInline />
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
