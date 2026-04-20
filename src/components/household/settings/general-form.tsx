"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateHouseholdSettings } from "@/features/household/actions";
import { updateHouseholdSettingsSchema } from "@/features/household/schema";

/**
 * Form-level shape BEFORE Zod's cycleDuration transform (string → number).
 * RHF holds the raw string values the user picks in the Select; the server
 * action accepts this shape and runs the transform at parse time (Plan 02
 * updateHouseholdSettingsSchema).
 */
type GeneralFormValues = {
  householdId: string;
  householdSlug: string;
  name: string;
  timezone: string;
  cycleDuration: "1" | "3" | "7" | "14";
};

interface GeneralFormProps {
  household: {
    id: string;
    name: string;
    timezone: string;
    cycleDuration: number;
  };
  householdSlug: string;
  viewerRole: "OWNER" | "MEMBER";
}

const CYCLE_DURATION_OPTIONS: { value: "1" | "3" | "7" | "14"; label: string }[] = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
];

export function GeneralForm({
  household,
  householdSlug,
  viewerRole,
}: GeneralFormProps) {
  // Node 20+ (Next.js 16 minimum) supports Intl.supportedValuesOf per RESEARCH
  // §Environment Availability. The try/catch + ["UTC"] fallback prevents an
  // empty select if a runtime unexpectedly returns an empty array.
  const timezones = useMemo(() => {
    try {
      const zones =
        (
          Intl as typeof Intl & {
            supportedValuesOf?: (key: string) => string[];
          }
        ).supportedValuesOf?.("timeZone") ?? [];
      return zones.length > 0 ? zones.slice().sort() : ["UTC"];
    } catch {
      return ["UTC"];
    }
  }, []);

  // MEMBER view: three labelled read-only rows, no <Form> wrapper.
  if (viewerRole !== "OWNER") {
    const cycleLabel =
      household.cycleDuration === 1
        ? "1 day"
        : `${household.cycleDuration} days`;

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Name</span>
          <span className="text-sm text-muted-foreground text-right">
            {household.name}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Timezone</span>
          <span className="text-sm text-muted-foreground text-right">
            {household.timezone}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Cycle</span>
          <span className="text-sm text-muted-foreground text-right">
            {cycleLabel}
          </span>
        </div>
      </div>
    );
  }

  // OWNER view: RHF + Zod form. The resolver runs the server-side schema in
  // the browser; cycleDuration is kept as a string in form state and the
  // transform runs on parse (same object goes to the Server Action).
  const defaultCycleValue = (
    ["1", "3", "7", "14"].includes(String(household.cycleDuration))
      ? (String(household.cycleDuration) as "1" | "3" | "7" | "14")
      : "7"
  ) as "1" | "3" | "7" | "14";

  const form = useForm<GeneralFormValues>({
    // The schema's output type is post-transform (cycleDuration: number) while
    // form values carry the pre-transform string. zodResolver accepts this
    // discrepancy at runtime — we narrow the resolver type to the form's I/O.
    resolver: zodResolver(
      updateHouseholdSettingsSchema,
    ) as unknown as import("react-hook-form").Resolver<GeneralFormValues>,
    defaultValues: {
      householdId: household.id,
      householdSlug,
      name: household.name,
      timezone: household.timezone,
      cycleDuration: defaultCycleValue,
    },
  });

  async function onSubmit(values: GeneralFormValues) {
    // The zodResolver transforms cycleDuration to a number during validation
    // — coerce back to the pre-transform string shape the Server Action
    // schema expects on the wire (Plan 02 D-32 updateHouseholdSettingsSchema
    // runs the enum→Number transform server-side).
    const payload = {
      ...values,
      cycleDuration: String(values.cycleDuration) as "1" | "3" | "7" | "14",
    };
    const result = await updateHouseholdSettings(payload);
    if ("error" in result) {
      toast.error(result.error ?? "Couldn't save settings. Try again.");
      return;
    }
    toast.success("Household settings saved.");
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {/* Hidden fields — Phase 2 D-04 pattern (householdId + householdSlug threaded to the action). */}
        <input type="hidden" {...form.register("householdId")} />
        <input type="hidden" {...form.register("householdSlug")} />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Household name</FormLabel>
              <FormControl>
                <Input
                  maxLength={100}
                  placeholder="e.g. Home, Office, Studio"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cycleDuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cycle duration</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as "1" | "3" | "7" | "14")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select cycle duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {CYCLE_DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Changes take effect at the next cycle boundary, not immediately.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
