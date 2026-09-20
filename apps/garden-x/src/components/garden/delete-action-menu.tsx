import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useGarden } from "@/lib/garden-store";
import { ui } from "@/lib/ui-copy";

interface DeleteActionMenuProps {
  itemLabel: string;
  actionLabel: string;
  title: string;
  description: string;
  onConfirm: () => Promise<boolean | void>;
}

/** A small, shared destructive action that keeps the existing card surfaces intact. */
export function DeleteActionMenu({
  itemLabel,
  actionLabel,
  title,
  description,
  onConfirm,
}: DeleteActionMenuProps) {
  const { language } = useGarden();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${ui(language, "actionsFor")} ${itemLabel === "photo" ? ui(language, "photo") : ui(language, "event")}`}
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {actionLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{ui(language, "cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                busy && "opacity-60",
              )}
              onClick={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                  const completed = await onConfirm();
                  if (completed !== false) setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? ui(language, "deleting") : ui(language, "deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
