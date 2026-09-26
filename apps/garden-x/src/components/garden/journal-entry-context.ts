import { createContext, useContext } from "react";

export type JournalEntryContext = { gardenId?: string; plantId?: string };
export type JournalEntryApi = { open: (context?: JournalEntryContext) => void };

export const JournalEntryContextProvider = createContext<JournalEntryApi | null>(null);

export function useJournalEntry() {
  const context = useContext(JournalEntryContextProvider);
  if (!context) throw new Error("useJournalEntry must be used inside JournalEntryProvider");
  return context.open;
}
