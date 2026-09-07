import { Sprout } from 'lucide-react'
import type { HarvestReadiness as Readiness } from '../domain/types'
import { harvestReadinessLabel } from '../domain/invariants'

export function HarvestReadiness({ value }: { value: Readiness }) {
  return <span className="readiness"><Sprout size={15} aria-hidden="true" /> Cosecha: {harvestReadinessLabel[value]}</span>
}
