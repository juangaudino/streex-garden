import type { Photo, Plant, PlantEvent } from "@/lib/garden-data";

export type PublicStoryMoment =
  | { id: string; daysAgo: number; kind: "photo"; photo: Photo }
  | { id: string; daysAgo: number; kind: "event"; event: PlantEvent };

export interface PublicStory {
  id: string;
  plant: Pick<Plant, "id" | "name" | "species" | "scientific" | "variety" | "plantedDaysAgo">;
  moments: PublicStoryMoment[];
}