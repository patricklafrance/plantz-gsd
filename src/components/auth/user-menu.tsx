"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email: string;
  name?: string | null;
}

function getInitials(email: string, name?: string | null): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

export function UserMenu({ email, name }: UserMenuProps) {
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/preferences")}
          className="cursor-pointer gap-2"
        >
          <Settings className="h-4 w-4" />
          Preferences
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
