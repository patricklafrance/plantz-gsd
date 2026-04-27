"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function SearchBar({ defaultValue, basePath }: { defaultValue?: string; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const basePathRef = useRef(basePath);
  basePathRef.current = basePath;

  const updateURL = useMemo(
    () =>
      debounce((query: string) => {
        const params = new URLSearchParams(searchParamsRef.current.toString());
        if (query) {
          params.set("search", query);
        } else {
          params.delete("search");
        }
        const qs = params.toString();
        router.push(qs ? `${basePathRef.current}?${qs}` : basePathRef.current);
      }, 300),
    [] // stable — reads from refs
  );

  function handleClear() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        placeholder="Search plants..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateURL(e.target.value);
        }}
        className="pl-9 pr-8 text-sm"
        aria-label="Search plants"
      />
      {value && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={handleClear}
                aria-label="Clear search"
              />
            }
          >
            <X className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Clear search</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
