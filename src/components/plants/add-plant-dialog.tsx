"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Leaf, Plus, ChevronLeft } from "lucide-react";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { createPlant } from "@/features/plants/actions";
import { createPlantSchema, type CreatePlantInput } from "@/features/plants/schemas";
import { CATALOG_CATEGORIES, catalogData } from "../../../prisma/data/catalog";
import type { CareProfile } from "@/generated/prisma/client";

// Build a name->category map for grouping DB entries
const categoryByName = new Map<string, string>(
  catalogData.map((entry) => [entry.name, entry.category])
);

type Room = { id: string; name: string };

interface AddPlantDialogProps {
  catalog: CareProfile[];
  rooms: Room[];
}

export function AddPlantDialog({ catalog, rooms }: AddPlantDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"catalog" | "form">("catalog");
  const [selectedProfile, setSelectedProfile] = useState<CareProfile | null>(null);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const form = useForm<CreatePlantInput>({
    resolver: zodResolver(createPlantSchema),
    defaultValues: {
      nickname: "",
      species: "",
      roomId: undefined,
      wateringInterval: 7,
    },
  });

  function handleSelectProfile(profile: CareProfile) {
    setSelectedProfile(profile);
    form.setValue("species", profile.species ?? "");
    form.setValue("wateringInterval", profile.wateringInterval);
    setStep("form");
  }

  function handleCustomPlant() {
    setSelectedProfile(null);
    form.setValue("species", "");
    form.setValue("wateringInterval", 7);
    setStep("form");
  }

  function handleBackToCatalog() {
    setStep("catalog");
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      // Delay reset until after the close animation completes
      setTimeout(() => {
        setStep("catalog");
        setSelectedProfile(null);
        setSearch("");
        setFormError(undefined);
        form.reset({
          nickname: "",
          species: "",
          roomId: undefined,
          wateringInterval: 7,
        });
      }, 200);
    }
  }

  async function onSubmit(data: CreatePlantInput) {
    setFormError(undefined);
    const result = await createPlant({
      ...data,
      careProfileId: selectedProfile?.id,
    });

    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    toast("Plant added.");
    handleOpenChange(false);
  }

  // Filter and group catalog entries
  const filteredCatalog = catalog.filter((entry) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      entry.name.toLowerCase().includes(q) ||
      (entry.species ?? "").toLowerCase().includes(q)
    );
  });

  // Group by category using CATALOG_CATEGORIES order
  // CareProfile from DB doesn't have category field — use catalogData name->category map
  const groupedCatalog = CATALOG_CATEGORIES.map((category) => ({
    category,
    entries: filteredCatalog.filter(
      (entry) => categoryByName.get(entry.name) === category
    ),
  })).filter((group) => group.entries.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            Add plant
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[32rem] max-h-[90vh] overflow-y-auto">
        {step === "catalog" ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose a plant</DialogTitle>
            </DialogHeader>

            {/* Search */}
            <div className="mt-2">
              <Input
                placeholder="Search plants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Catalog grid */}
            <div className="mt-4 space-y-4">
              {groupedCatalog.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No plants match your search.
                </p>
              )}

              {groupedCatalog.map(({ category, entries }) => (
                <div key={category}>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">
                    {category}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {entries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleSelectProfile(entry)}
                        className="flex flex-col items-center p-2 rounded-lg border border-border bg-card text-center hover:border-accent/60 hover:bg-accent/5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 mb-1">
                          <Leaf className="h-4 w-4 text-accent" />
                        </div>
                        <p className="text-sm font-medium leading-tight">{entry.name}</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-1">
                          {entry.species}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Custom plant option */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCustomPlant}
                    className="flex flex-col items-center p-2 rounded-lg border border-dashed border-border bg-card text-center hover:border-accent/60 hover:bg-accent/5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted mb-1">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium leading-tight">Custom plant</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-1">
                      Not in the list
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToCatalog}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to catalog
                </button>
              </div>
              <DialogTitle>Add plant details</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                {/* Nickname */}
                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kitchen Pothos" maxLength={40} {...field} />
                      </FormControl>
                      {(field.value?.length ?? 0) > 20 && (
                        <p className="text-xs text-muted-foreground text-right">
                          {field.value?.length ?? 0}/40
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Species */}
                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Species</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Epipremnum aureum"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Room */}
                <FormField
                  control={form.control}
                  name="roomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value === "" ? undefined : value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="No room" />
                          </SelectTrigger>
                          <SelectContent>
                            {rooms.map((room) => (
                              <SelectItem key={room.id} value={room.id}>
                                {room.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Watering interval */}
                <FormField
                  control={form.control}
                  name="wateringInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watering interval</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            className="w-24"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 1)
                            }
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form error */}
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Add plant
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
