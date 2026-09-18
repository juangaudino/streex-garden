import type { GardenKind } from "./garden-data";

/**
 * Known growing setups. A known system already defines its own physical
 * position count and layout — the user never types a pod number for these.
 * Manual position configuration belongs only to the custom entry.
 */
export interface GardenSetup {
  id: string;
  label: string;
  hint: string;
  kind: GardenKind;
  /** Systems with positions declare them here. */
  system?: { name: string; pods: number };
  /** True only for the custom/other entry, which asks for a position count. */
  manualPositions?: boolean;
}

export const gardenSetups: GardenSetup[] = [
  {
    id: "aera-one",
    label: "Aera One",
    hint: "Indoor hydroponic system · 6 positions",
    kind: "hydroponic",
    system: { name: "Aera One", pods: 6 },
  },
  {
    id: "aera-twelve",
    label: "Aera Twelve",
    hint: "Tall hydroponic tower · 12 positions",
    kind: "hydroponic",
    system: { name: "Aera Twelve", pods: 12 },
  },
  {
    id: "leaf-cabinet",
    label: "Leaf Cabinet",
    hint: "Indoor grow cabinet · 8 positions",
    kind: "indoor",
    system: { name: "Leaf Cabinet", pods: 8 },
  },
  { id: "balcony", label: "Balcony pots", hint: "Pots and planters, no fixed positions", kind: "balcony" },
  { id: "backyard", label: "Backyard beds", hint: "Open ground or raised beds", kind: "backyard" },
  { id: "herb", label: "Herb corner", hint: "A small indoor herb collection", kind: "herb" },
  {
    id: "custom",
    label: "Custom system",
    hint: "Another system — you set the number of positions",
    kind: "hydroponic",
    manualPositions: true,
  },
];

export const setupById = (id: string) => gardenSetups.find((s) => s.id === id);