"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createNote } from "@/features/notes/actions";

interface NoteInputProps {
  plantId: string;
}

export function NoteInput({ plantId }: NoteInputProps) {
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    setIsPending(true);
    const result = await createNote({ plantId, content: trimmed });
    setIsPending(false);

    if ("error" in result) {
      toast.error("Couldn't add note. Try again.");
      return;
    }

    setValue("");
    toast("Note added.");
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Add a note..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        aria-label="Note text"
        className="text-sm"
        disabled={isPending}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={isPending || !value.trim()}
      >
        Add
      </Button>
    </div>
  );
}
