import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, onboardingCompleted: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-md">
          <Link href="/dashboard" className="flex items-center gap-sm">
            <Leaf className="h-5 w-5 text-accent" />
            <span className="text-base font-semibold">Plant Minder</span>
          </Link>
          <div className="flex items-center gap-md">
            {!user?.onboardingCompleted && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-accent hover:underline"
              >
                Complete setup
              </Link>
            )}
            <span className="text-sm text-muted">{user?.email}</span>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-md py-lg">
        {children}
      </main>
    </div>
  );
}
