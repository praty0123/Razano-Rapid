import { bikeEta, kmBetween } from './format'
import type { Booking } from './types'

/** Live distance (km) and ETA (min) for a booking that's on the way. */
export function liveEta(b: Booking | null): { km: number | null; min: number | null; live: boolean } {
  if (!b) return { km: null, min: null, live: false }
  if (b.status === 'arrived' || b.status === 'in_progress') return { km: 0, min: 0, live: true }
  const n = b.nurse
  const fresh = n?.loc_at && Date.now() - new Date(n.loc_at).getTime() < 10 * 60000
  if (n && fresh && n.lat != null && n.lng != null && b.lat != null && b.lng != null) {
    const km = kmBetween([n.lat, n.lng], [b.lat, b.lng])
    return { km: Math.round(km * 10) / 10, min: km < 0.15 ? 1 : bikeEta(km), live: true }
  }
  if (b.status === 'accepted' && b.accepted_at) {
    const since = (Date.now() - new Date(b.accepted_at).getTime()) / 60000
    return { km: null, min: Math.max(3, Math.round(20 - since)), live: false }
  }
  if (b.mode === 'now' && (b.status === 'assigned' || b.status === 'waiting')) return { km: null, min: 20, live: false }
  return { km: null, min: null, live: false }
}
