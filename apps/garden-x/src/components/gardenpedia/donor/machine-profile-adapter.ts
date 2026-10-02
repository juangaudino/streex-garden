import { gardenMachineFacts } from "@/generated/garden-machine-facts";

export type MachineProfileLanguage = "en" | "es";

export type CanonicalMachineModel = {
  id: string;
  vendor: string;
  name: string;
  modelNumber: string;
  maxGrowHeightCm: number;
  source: {
    title: string;
    publisher: string;
    url: string;
    note: string;
  };
};

export function canonicalMachineModels(): CanonicalMachineModel[] {
  return Object.values(gardenMachineFacts.systemDefinitions).map((definition) => ({
    id: definition.modelId,
    vendor: definition.modelName.split(" ")[0] ?? "Gardenpedia",
    name: definition.modelName,
    modelNumber: definition.modelNumber,
    maxGrowHeightCm: definition.maxGrowHeightCm,
    source: definition.source,
  }));
}

export function canonicalMachineModel(modelId: string): CanonicalMachineModel | null {
  return canonicalMachineModels().find((model) => model.id === modelId) ?? null;
}

/**
 * Public machine view models intentionally contain model facts only. System
 * instances and instance layouts are not imported into the Gardenpedia route.
 */
export function publicMachineViewModel(model: CanonicalMachineModel) {
  return {
    ...model,
    publicFacts: [
      { label: "Model", value: model.modelNumber },
      { label: "Maximum documented grow height", value: `${model.maxGrowHeightCm} cm` },
    ],
  };
}
