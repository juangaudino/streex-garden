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
  /** Published Gardenpedia machine identity, when this is a known public model. */
  gardenpediaModelId?: string;
  /** Systems with positions declare them here. */
  system?: { name: string; pods: number };
}

export const gardenSetups: GardenSetup[] = [
  {
    id: "aera-one",
    label: "URUQ 8-Pod",
    hint: "Published Gardenpedia machine · 8 positions",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    systemDefinitionKey: "uruq_8_v1",
    gardenpediaModelId: "uruq-hp-gc001",
    system: { name: "URUQ 8-Pod", pods: 8 },
  },
  {
    id: "aera-twelve",
    label: "URUQ 12-Pod",
    hint: "Published Gardenpedia machine · 12 positions",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    systemDefinitionKey: "uruq_12_v1",
    gardenpediaModelId: "uruq-hp-gc202",
    system: { name: "URUQ 12-Pod", pods: 12 },
  },
  {
    id: "leaf-cabinet",
    label: "Ahopegarden 10-Pod",
    hint: "Published Gardenpedia machine · 10 positions",
    kind: "indoor",
    systemDefinitionKey: "ahopegarden_10_v1",
    gardenpediaModelId: "ahopegarden-hsxa1",
    system: { name: "Ahopegarden 10-Pod", pods: 10 },
  },
  {
    id: "aerogarden-sprout",
    label: "AeroGarden Sprout",
    hint: "Published Gardenpedia machine · 3 positions",
    kind: "indoor",
    systemDefinitionKey: "aerogarden_sprout_v1",
    gardenpediaModelId: "aerogarden-sprout",
    system: { name: "AeroGarden Sprout", pods: 3 },
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
