"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/features/household/actions";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    const result = await acceptInvitation({ token });
    setIsPending(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    // Server Action returns { success: true, redirectTo }. Client navigates;
    // post-navigation revalidatePath (fired in the action) ensures the
    // dashboard reflects the new membership.
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Button
        type="submit"
        variant="default"
        disabled={isPending}
        className="min-h-[44px] w-full"
      >
        Accept and join
      </Button>
    </form>
  );
}
