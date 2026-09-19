import { ArrowDownUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortOrder } from "@/lib/garden-logic";

export function ChronologySelect({
  value,
  onChange,
  label = "Sort order",
}: {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SortOrder)}>
      <SelectTrigger
        aria-label={label}
        className="h-9 w-auto min-w-32 justify-start gap-1.5 rounded-full border-border/70 bg-card px-3 text-xs shadow-soft"
      >
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="newest">Newest first</SelectItem>
        <SelectItem value="oldest">Oldest first</SelectItem>
      </SelectContent>
    </Select>
  );
}
