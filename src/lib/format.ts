const TZ = 'Asia/Kolkata'

export const rupees = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export function istDayKey(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}
export function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = istDayKey(new Date())
  const tomorrow = istDayKey(new Date(Date.now() + 86400000))
  const k = istDayKey(d)
  if (k === today) return 'Today'
  if (k === tomorrow) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}
export function timeLabel(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}
export function slotLabel(iso: string) {
  const end = new Date(new Date(iso).getTime() + 30 * 60000).toISOString()
  return `${timeLabel(iso)} – ${timeLabel(end)}`
}
export function dateTimeLabel(iso: string | null | undefined) {
  if (!iso) return ''
  return `${dayLabel(iso)}, ${timeLabel(iso)}`
}
export function agoLabel(iso: string | null | undefined) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} hr ago`
}
export function initials(name: string | null | undefined) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}
export function firstName(name: string | null | undefined) {
  return (name || '').split(/\s+/)[0] || ''
}
export function patientLine(p: { name: string; age: number; gender: string | null }) {
  return `${p.name} (${p.age}${p.gender ? ' ' + p.gender : ''})`
}
export function addressLine(a: { line1: string; line2: string | null; sector: number | null }) {
  return [a.line1, a.line2, a.sector ? `Sector ${a.sector}` : null, 'Gurgaon'].filter(Boolean).join(', ')
}
export function kmBetween(a: [number, number], b: [number, number]) {
  const R = 6371, toR = (x: number) => (x * Math.PI) / 180
  const dLat = toR(b[0] - a[0]), dLng = toR(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
/** Bike ETA in minutes: road distance ≈ 1.4× straight line at ~20 km/h city speed */
export function bikeEta(km: number) {
  return Math.max(2, Math.ceil((km * 1.4) / 20 * 60))
}
export const waLink = (num: string, text: string) => `https://wa.me/${num.replace(/\D/g, '').replace(/^(?=[6-9]\d{9}$)/, '91')}?text=${encodeURIComponent(text)}`
export const telLink = (num: string) => `tel:${num.replace(/[^\d+]/g, '').replace(/^(?=[6-9]\d{9}$)/, '+91')}`
