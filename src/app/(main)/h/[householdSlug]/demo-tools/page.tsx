import { redirect } from "next/navigation";
import { auth } from "../../../../../../auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentHousehold } from "@/features/household/context";
import { DemoToolsForm } from "@/components/demo/demo-tools-form";

type PageProps = {
  params: Promise<{ householdSlug: string }>;
};

export default async function DemoToolsPage({ params }: PageProps) {
  const { householdSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.isDemo) {
    redirect(`/h/${householdSlug}/dashboard`);
  }

  const { household } = await getCurrentHousehold(householdSlug);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 pb-20 sm:pb-8">
      <header>
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>
          Demo &amp; testing tools
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{household.name}</p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Heads up</CardTitle>
          <CardDescription>
            These tools are intended for testing and demo purposes only. They
            create real records in this household — only use them on accounts
            you don&apos;t mind populating with sample data.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Seed starter plants</CardTitle>
          <CardDescription>
            Adds a batch of random plants from the catalog to this household so
            you can exercise dashboards, rotation, and reminders without hand-
            entering data. Safe to run multiple times — duplicates will simply
            stack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DemoToolsForm householdId={household.id} />
        </CardContent>
      </Card>
    </main>
  );
}
