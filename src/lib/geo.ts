/**
 * Address search + reverse lookup using Photon (OpenStreetMap data, free, made for search-as-you-type).
 * Results are limited to the Gurgaon box.
 */
export interface Place { label: string; sub: string; lat: number; lng: number; sector: number | null }

const BBOX = '76.85,28.30,77.20,28.55' // minLon,minLat,maxLon,maxLat ≈ Gurugram
const BIAS = 'lat=28.418&lon=77.062'

export function sectorOf(...parts: (string | null | undefined)[]): number | null {
  const m = /sector[\s\-–]*(\d{1,3})/i.exec(parts.filter(Boolean).join(' '))
  return m ? Number(m[1]) : null
}

function toPlace(f: any): Place {
  const p = f.properties || {}
  const [lng, lat] = f.geometry.coordinates
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const label = p.name || street || p.locality || p.district || 'Pinned location'
  const sub = [...new Set([p.name ? street : '', p.locality, p.district, p.city || 'Gurugram'].filter(Boolean))].join(', ')
  return { label, sub, lat, lng, sector: sectorOf(p.name, p.street, p.locality, p.district) }
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&${BIAS}&bbox=${BBOX}&limit=7&lang=en`
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error('Search unavailable')
  const j = await r.json()
  return (j.features || []).map(toPlace)
}

export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<Place | null> {
  const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`, { signal })
  if (!r.ok) return null
  const j = await r.json()
  return j.features?.[0] ? toPlace(j.features[0]) : null
}
