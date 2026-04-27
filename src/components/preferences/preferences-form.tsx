"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleGlobalReminders } from "@/features/reminders/actions";
import { toast } from "sonner";
import { AccountSettings } from "./account-settings";

interface PreferencesFormProps {
  initialRemindersEnabled: boolean;
  userEmail: string;
  isDemo?: boolean;
}

export function PreferencesForm({
  initialRemindersEnabled,
  userEmail,
  isDemo,
}: PreferencesFormProps) {
  const [remindersEnabled, setRemindersEnabled] = useState(initialRemindersEnabled);
  const [isPending, setIsPending] = useState(false);

  async function handleToggle(checked: boolean) {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }

    // Optimistic toggle
    setRemindersEnabled(checked);
    setIsPending(true);

    const result = await toggleGlobalReminders({ enabled: checked });
    setIsPending(false);

    if (result?.error) {
      setRemindersEnabled(!checked);
      toast.error("Could not save preferences. Try again.");
    } else {
      toast.success("Preferences saved.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">
          Preferences
        </h1>
      </header>

      {/* Notifications section */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label
                htmlFor="global-reminders-toggle"
                className="text-sm font-semibold"
              >
                In-app reminders
              </label>
              <p className="text-xs text-muted-foreground">
                When on, plants needing water appear in your notification center.
              </p>
            </div>
            <Switch
              id="global-reminders-toggle"
              checked={remindersEnabled}
              onCheckedChange={handleToggle}
              disabled={isPending || !!isDemo}
              aria-label="In-app reminders"
            />
          </div>
        </CardContent>
      </Card>

      {/* Account section */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettings userEmail={userEmail} isDemo={isDemo} />
        </CardContent>
      </Card>
    </div>
  );
}
