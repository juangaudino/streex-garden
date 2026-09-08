import { GrowthRings } from './GrowthRings'

export function PlaceIdentity({ number, placeId, origin = 'profile' }: { number: number; placeId: string; origin?: string }) {
  return <span className="place-identity" data-place-id={placeId} data-place-origin={origin} aria-hidden="true"><GrowthRings /><span>{String(number).padStart(2, '0')}</span></span>
}
