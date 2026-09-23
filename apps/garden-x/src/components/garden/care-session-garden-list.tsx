import { useRef, useState, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";

export interface CareSessionGardenItem {
  id: string;
  name: string;
  systemName?: string | undefined;
  plantCount: number;
}

export function CareSessionGardenList({
  gardens,
  selectedIds,
  selectedLabel,
  notSelectedLabel,
  reorderLabel,
  plantsLabel,
  onToggle,
  onReorder,
}: {
  gardens: CareSessionGardenItem[];
  selectedIds: string[];
  selectedLabel: string;
  notSelectedLabel: string;
  reorderLabel: string;
  plantsLabel: string;
  onToggle: (gardenId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const drag = useRef<{ id: string; pointerId: number; startY: number; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const beginDrag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    drag.current = { id, pointerId: event.pointerId, startY: event.clientY, moved: false };
    setDraggingId(id);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers do not implement pointer capture; the list-level handlers still work.
    }
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.moved && Math.abs(event.clientY - active.startY) < 8) return;
    active.moved = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-care-garden-id]");
    const targetId = target?.dataset.careGardenId;
    if (targetId && targetId !== active.id) onReorder(active.id, targetId);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraggingId(null);
  };

  return (
    <div className="mt-3 divide-y divide-border/70" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {gardens.map((garden) => {
        const selected = selectedIds.includes(garden.id);
        return (
          <div
            key={garden.id}
            data-care-garden-id={garden.id}
            className={`flex items-center gap-3 py-3 ${draggingId === garden.id ? "opacity-45" : ""}`}
          >
            <button
              type="button"
              onPointerDown={(event) => beginDrag(event, garden.id)}
              className="grid h-9 w-8 shrink-0 touch-none cursor-grab place-items-center text-muted-foreground active:cursor-grabbing"
              aria-label={`${reorderLabel}: ${garden.name}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(garden.id)}
              aria-label={`${selected ? selectedLabel : notSelectedLabel}: ${garden.name}`}
              className="h-4 w-4 accent-primary"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {garden.name}
              {garden.systemName ? <span className="ml-2 text-xs font-normal text-muted-foreground">{garden.systemName}</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">{garden.plantCount} {plantsLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
