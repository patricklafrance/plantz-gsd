"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogFooter as DialogFooter,
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

import { updatePlant } from "@/features/plants/actions";
import { editPlantSchema, type EditPlantInput } from "@/features/plants/schemas";
import type { PlantWithRelations } from "@/types/plants";

type Room = { id: string; name: string };

interface EditPlantDialogProps {
  plant: PlantWithRelations;
  rooms: Room[];
  householdId: string;
}

export function EditPlantDialog({ plant, rooms, householdId }: EditPlantDialogProps) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const form = useForm<EditPlantInput>({
    resolver: zodResolver(editPlantSchema),
    defaultValues: {
      householdId,
      id: plant.id,
      nickname: plant.nickname,
      species: plant.species ?? "",
      roomId: plant.roomId ?? undefined,
      wateringInterval: plant.wateringInterval,
    },
  });

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setFormError(undefined);
      form.reset({
        householdId,
        id: plant.id,
        nickname: plant.nickname,
        species: plant.species ?? "",
        roomId: plant.roomId ?? undefined,
        wateringInterval: plant.wateringInterval,
      });
    }
  }

  async function onSubmit(data: EditPlantInput) {
    setFormError(undefined);
    const result = await updatePlant(data);

    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    toast("Changes saved.");
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>Edit plant</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Hidden householdId — required by editPlantSchema (D-04) */}
            <input type="hidden" {...form.register("householdId")} />

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
                  <FormLabel>
                    Room{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(value) =>
                        field.onChange(value === "" ? null : value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No room" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No room</SelectItem>
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
                  <div className="flex items-center gap-2">
                    <FormControl>
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
                    </FormControl>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form error */}
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            {/* Footer actions */}
            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
