"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { z } from "zod/v4";

import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { logWatering, editWateringLog } from "@/features/watering/actions";
import { cn } from "@/lib/utils";

// Local form schema — the server actions do their own Zod validation,
// so this only needs to capture the form fields for react-hook-form.
const formSchema = z.object({
  wateredAt: z.date().optional(),
  note: z.string().max(280).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LogWateringDialogProps {
  plantId: string;
  plantNickname: string;
  editLog?: { id: string; wateredAt: Date; note: string | null };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLogged?: () => void;
  onEdited?: () => void;
}

export function LogWateringDialog({
  plantId,
  plantNickname,
  editLog,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onLogged,
  onEdited,
}: LogWateringDialogProps) {
  const isEditMode = !!editLog;
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      wateredAt: isEditMode ? editLog.wateredAt : new Date(),
      note: isEditMode ? (editLog.note ?? "") : "",
    },
  });

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      form.reset({
        wateredAt: isEditMode ? editLog!.wateredAt : new Date(),
        note: isEditMode ? (editLog!.note ?? "") : "",
      });
    }
  }

  async function onSubmit(data: FormValues) {
    if (isEditMode) {
      const result = await editWateringLog({
        logId: editLog!.id,
        wateredAt: data.wateredAt,
        note: data.note || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast("Watering log updated.");
      handleOpenChange(false);
      onEdited?.();
    } else {
      const result = await logWatering({
        plantId,
        wateredAt: data.wateredAt,
        note: data.note || undefined,
      });
      if ("error" in result) {
        if (result.error === "DUPLICATE") {
          toast("Already logged! Edit from history if needed.");
        } else {
          toast.error(result.error ?? "Couldn't log watering. Try again.");
        }
        return;
      }
      if ("success" in result && result.success) {
        const wateredAt = data.wateredAt ?? new Date();
        toast(
          `${plantNickname} watered on ${format(wateredAt, "MMMM d")}. Next: ${format(new Date(result.nextWateringAt), "MMMM d")}`
        );
        handleOpenChange(false);
        onLogged?.();
      }
    }
  }

  const dialogContent = (
    <DialogContent className="sm:max-w-[28rem]">
      <DialogHeader>
        <DialogTitle>
          {isEditMode ? "Edit watering log" : "Log watering"}
        </DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Date field */}
          <FormField
            control={form.control}
            name="wateredAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        />
                      }
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {field.value
                        ? format(field.value, "MMMM d, yyyy")
                        : "Pick a date"}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date: Date | undefined) => field.onChange(date)}
                        disabled={(date: Date) => date > new Date()}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Note field */}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Note{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional note (e.g. used filtered water)"
                    maxLength={280}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              {isEditMode ? "Discard changes" : "Don't log"}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {isEditMode ? "Save changes" : "Log watering"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          />
        }
      >
        Log watering
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
