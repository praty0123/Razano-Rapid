import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'sonner'
import { MAP_CENTER } from '../lib/config'
import { searchPlaces, type Place } from '../lib/geo'
import { Icon, Spinner } from './ui'

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; OpenStreetMap'

/** Search box + map with a fixed centre pin. The family searches, then drags the map so the pin sits on their door. */
export function MapPicker({ value, onChange, onPlace }: {
  value: [number, number] | null
  onChange: (v: [number, number]) => void
  onPlace?: (p: Place) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [locating, setLocating] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!el.current || map.current) return
    const start = value ?? MAP_CENTER
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(start, value ? 18 : 15)
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 }).addTo(m)
    m.on('moveend', () => { const c = m.getCenter(); cb.current([+c.lat.toFixed(6), +c.lng.toFixed(6)]) })
    map.current = m
    if (!value) cb.current(start)
    setTimeout(() => m.invalidateSize(), 250)
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // search as you type (debounced)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) { setResults(null); return }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      setSearching(true)
      try { setResults(await searchPlaces(term, ctl.signal)) } catch (e) { if ((e as Error).name !== 'AbortError') setResults([]) }
      finally { setSearching(false) }
    }, 400)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])

  const pick = (p: Place) => {
    setResults(null); setQ(p.label)
    map.current?.setView([p.lat, p.lng], 18)
    onPlace?.(p)
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Location not available on this phone')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); map.current?.setView([p.coords.latitude, p.coords.longitude], 18) },
      () => { setLocating(false); toast.error('Allow location access, or search your society above') },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" />
          <input className="field pl-10 pr-10" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search society, building or street" aria-label="Search address" autoComplete="off" />
          {searching ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary"><Spinner className="text-[18px]" /></span>
            : q && <button type="button" aria-label="Clear" onClick={() => { setQ(''); setResults(null) }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-outline"><Icon name="close" className="text-[18px]" /></button>}
        </div>
        {results && (
          <div className="absolute left-0 right-0 top-[52px] z-[1100] bg-surface-container-lowest rounded-xl shadow-[0_20px_30px_-10px_rgba(26,35,50,0.16)] border border-[#E2E8F0] max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-3 font-body-sm text-body-sm text-on-surface-variant">No match in Gurgaon. Try the society name, or drag the map to your door.</div>
            ) : results.map((r, i) => (
              <button type="button" key={i} onClick={() => pick(r)} className="w-full flex items-start gap-2 p-3 text-left hover:bg-surface-container-low border-b border-surface-container last:border-0">
                <Icon name="location_on" className="text-[20px] text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-label-lg text-label-lg text-on-surface truncate">{r.label}</div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{r.sub}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative isolate h-72 rounded-xl overflow-hidden shadow-sm bg-surface-container">
        <div ref={el} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-[500] flex flex-col items-center">
          <div className="mb-1 px-2 py-0.5 rounded-full bg-inverse-surface text-white font-label-sm text-label-sm whitespace-nowrap shadow-md">Nurse comes here</div>
          <Icon name="location_on" fill className="text-[44px] text-vital-red drop-shadow -mt-1" />
        </div>
        <div className="absolute top-2 left-2 z-[500] px-2.5 py-1 rounded-full bg-surface/95 shadow-md font-label-sm text-label-sm text-on-surface">
          Drag the map to put the pin on your door
        </div>
        <button type="button" onClick={locate} className="absolute left-2 bottom-2 z-[500] h-10 px-3 rounded-full bg-surface-container-lowest shadow-md flex items-center gap-1 text-primary font-label-md text-label-md active:scale-95">
          {locating ? <Spinner className="text-[18px]" /> : <Icon name="my_location" className="text-[18px]" />} Use my location
        </button>
      </div>
    </div>
  )
}
