import type { GardenCultivationMethod, GardenKind } from "./garden-data";

/**
 * Known growing setups. A known system already defines its own physical
 * position count and layout — the user never types a pod number for these.
 * The custom entry opens its dedicated builder; it never changes a preset.
 */
export interface GardenSetup {
  id: string;
  label: string;
  hint: string;
  kind: GardenKind;
  /** Known only where the selected setup itself specifies the growing method. */
  cultivationMethod?: GardenCultivationMethod;
  /** Stable system identity; unlike the editable display name, this is suitable for evidence conditions. */
  systemDefinitionKey?: string;
  /** Systems with positions declare them here. */
  system?: { name: string; pods: number };
}

export const gardenSetups: GardenSetup[] = [
  {
    id: "aera-one",
    label: "Aera One",
    hint: "Indoor hydroponic system · 6 positions",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    systemDefinitionKey: "aera-one-v1",
    system: { name: "Aera One", pods: 6 },
  },
  {
    id: "aera-twelve",
    label: "Aera Twelve",
    hint: "Tall hydroponic tower · 12 positions",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    systemDefinitionKey: "aera-twelve-v1",
    system: { name: "Aera Twelve", pods: 12 },
  },
  {
    id: "leaf-cabinet",
    label: "Leaf Cabinet",
    hint: "Indoor grow cabinet · 8 positions",
    kind: "indoor",
    systemDefinitionKey: "leaf-cabinet-v1",
    system: { name: "Leaf Cabinet", pods: 8 },
  },
  {
    id: "balcony",
    label: "Balcony pots",
    hint: "Pots and planters, no fixed positions",
    kind: "balcony",
    cultivationMethod: "container",
    systemDefinitionKey: "balcony-pots-v1",
  },
  {
    id: "backyard",
    label: "Backyard beds",
    hint: "Open ground or raised beds",
    kind: "backyard",
    cultivationMethod: "soil",
    systemDefinitionKey: "backyard-beds-v1",
  },
  { id: "herb", label: "Herb corner", hint: "A small indoor herb collection", kind: "herb" },
  {
    id: "custom",
    label: "Custom System",
    hint: "Build your own layout",
    kind: "hydroponic",
  },
];

export const setupById = (id: string) => gardenSetups.find((s) => s.id === id);
