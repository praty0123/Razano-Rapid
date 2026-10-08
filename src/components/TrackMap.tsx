import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_CENTER } from '../lib/config'

export interface TrackMapHandle { focusNurse: () => void; fitRoute: () => void }

const homeIcon = L.divIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#ffdad6;display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;border-radius:9999px;background:#ba1a1a"></div></div>',
})
const nurseIcon = (eta: string | null) => L.divIcon({
  className: '', iconSize: [120, 84], iconAnchor: [60, 62],
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    ${eta ? `<div style="display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:9999px;background:#ffddb8;color:#2a1700;box-shadow:0 4px 6px -1px rgb(0 0 0/.1);white-space:nowrap;font:700 12px/16px Manrope,sans-serif"><span class="material-symbols-outlined" style="font-size:15px;color:#603b00">bolt</span>${eta}</div>` : ''}
    <div style="position:relative;margin-top:4px;display:flex;align-items:center;justify-content:center">
      <span class="animate-ping" style="position:absolute;width:48px;height:48px;border-radius:9999px;background:rgba(0,82,204,.2)"></span>
      <div style="position:relative;width:44px;height:44px;border-radius:9999px;background:#0052cc;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 25px -5px rgb(0 0 0/.1),0 8px 10px -6px rgb(0 0 0/.1)">
        <span class="material-symbols-outlined" style="font-size:24px">moped</span>
      </div>
    </div></div>`,
})

export const TrackMap = forwardRef<TrackMapHandle, { home: [number, number] | null; nurse: [number, number] | null; etaText: string | null }>(
  function TrackMap({ home, nurse, etaText }, ref) {
    const el = useRef<HTMLDivElement>(null)
    const map = useRef<L.Map | null>(null)
    const layers = useRef<{ home?: L.Marker; nurse?: L.Marker; line?: L.Polyline }>({})
    const fitKey = useRef(0)

    const fitRoute = () => {
      const m = map.current; if (!m) return
      const pts = [home, nurse].filter(Boolean) as [number, number][]
      if (pts.length === 2) m.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [50, 120], paddingBottomRight: [70, 50], maxZoom: 16 })
      else if (pts.length === 1) m.setView(pts[0]!, 15)
    }
    useImperativeHandle(ref, () => ({
      focusNurse: () => { if (nurse) map.current?.setView(nurse, 16) },
      fitRoute,
    }))

    useEffect(() => {
      if (!el.current || map.current) return
      const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(home ?? MAP_CENTER, 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(m)
      map.current = m
      setTimeout(() => m.invalidateSize(), 200)
      return () => { m.remove(); map.current = null; layers.current = {}; fitKey.current = 0 }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const m = map.current; if (!m) return
      const L_ = layers.current
      if (home) { L_.home ? L_.home.setLatLng(home) : (L_.home = L.marker(home, { icon: homeIcon }).addTo(m)) }
      if (nurse) {
        if (L_.nurse) { L_.nurse.setLatLng(nurse); L_.nurse.setIcon(nurseIcon(etaText)) }
        else L_.nurse = L.marker(nurse, { icon: nurseIcon(etaText), zIndexOffset: 1000 }).addTo(m)
      } else if (L_.nurse) { L_.nurse.remove(); L_.nurse = undefined }
      if (home && nurse) {
        if (L_.line) L_.line.setLatLngs([nurse, home])
        else L_.line = L.polyline([nurse, home], { color: '#0052cc', weight: 4, dashArray: '6 8', lineCap: 'round', opacity: 0.8 }).addTo(m)
      } else if (L_.line) { L_.line.remove(); L_.line = undefined }
      const k = (home ? 1 : 0) + (nurse ? 2 : 0)
      if (k > fitKey.current) { fitRoute(); fitKey.current = k }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [home?.[0], home?.[1], nurse?.[0], nurse?.[1], etaText])

    return <div ref={el} className="w-full h-full" />
  })
