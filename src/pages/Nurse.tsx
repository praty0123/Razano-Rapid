import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { TabPage } from '../components/AppShell'
import { Avatar, EmptyCard, Field, Icon, PrimaryButton, Sheet, Spinner } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll, useNow } from '../lib/useInterval'
import { compressImage } from '../lib/image'
import { EMERGENCY, GP_NAME, GP_WHATSAPP, POLL_MS, RAZANO_WHATSAPP } from '../lib/config'
import { addressLine, bikeEta, dateTimeLabel, kmBetween, rupees, telLink, timeLabel, waLink } from '../lib/format'
import type { Booking, User } from '../lib/types'

interface Home {
  me: User; today_completed: number; incentive: number; active: Booking | null; upcoming: Booking[]; waiting: number
  recent: { id: string; ref: string; patient: { name: string }; services: { name: string }[]; completed_at: string; pay_status: string; total: number }[]
}

// ---------- alert sound + screen wake ----------
let audioCtx: AudioContext | null = null
function unlockAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)(); audioCtx.resume() } catch { /* no audio */ }
}
function beep() {
  if (!audioCtx) return
  const t = audioCtx.currentTime
  ;[0, 0.25, 0.5].forEach((d, i) => {
    const o = audioCtx!.createOscillator(), g = audioCtx!.createGain()
    o.frequency.value = i === 2 ? 1175 : 880; o.type = 'sine'
    g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.5, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2)
    o.connect(g).connect(audioCtx!.destination); o.start(t + d); o.stop(t + d + 0.22)
  })
  try { navigator.vibrate?.([300, 150, 300]) } catch { /* ignore */ }
}

export default function Nurse() {
  const { user, ready, requireAuth } = useSession()
  if (ready && !user) {
    return <TabPage><div className="px-margin-mobile pt-2 flex flex-col gap-3">
      <EmptyCard icon="badge" title="Razano nurse partners" text="Log in with the account Razano created for you to receive visits."
        action={<PrimaryButton onClick={() => requireAuth().catch(() => {})}>Nurse log in</PrimaryButton>} />
      <a href={waLink(RAZANO_WHATSAPP, 'Hi, I am a registered nurse (GNM/B.Sc) and want to join Razano Rapid.')} target="_blank" rel="noreferrer"
        className="text-center font-label-lg text-label-lg text-primary py-2">Registered nurse? Join Razano Rapid</a>
    </div></TabPage>
  }
  if (!user) return <TabPage><div className="flex justify-center pt-16 text-primary"><Spinner className="text-[32px]" /></div></TabPage>
  if (user.role !== 'nurse') {
    return <TabPage><div className="px-margin-mobile pt-2">
      <EmptyCard icon="badge" title="Nurse Mode is for Razano nurses" text={user.role === 'admin' ? 'You are logged in as admin.' : 'This area is for our nursing team. Want to join as a nurse? WhatsApp us.'}
        action={user.role === 'admin' ? <Link to="/admin" className="block"><PrimaryButton>Open Admin</PrimaryButton></Link> :
          <a href={waLink(RAZANO_WHATSAPP, 'Hi, I am a registered nurse and want to join Razano Rapid.')} target="_blank" rel="noreferrer"><PrimaryButton>WhatsApp us</PrimaryButton></a>} />
    </div></TabPage>
  }
  return <NurseHome />
}

function NurseHome() {
  const { refresh } = useSession()
  const [h, setH] = useState<Home | null>(null)
  const [dutyBusy, setDutyBusy] = useState(false)
  const [vitalsFor, setVitalsFor] = useState<Booking | null>(null)
  const alerted = useRef<string | null>(null)
  const lastSent = useRef(0)
  const lastPos = useRef<[number, number] | null>(null)
  const [myPos, setMyPos] = useState<[number, number] | null>(null)

  const load = useCallback(async () => {
    try { setH(await rpc<Home>('rr_nurse_home')) } catch (e) { toast.error((e as Error).message) }
  }, [])
  usePoll(load, POLL_MS)

  const onDuty = !!h?.me.on_duty
  const active = h?.active || null

  // GPS sharing while on duty
  useEffect(() => {
    if (!onDuty || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(p => {
      lastPos.current = [p.coords.latitude, p.coords.longitude]
      setMyPos(lastPos.current)
      if (Date.now() - lastSent.current > 20000) {
        lastSent.current = Date.now()
        rpc('rr_nurse_ping', { p_lat: p.coords.latitude, p_lng: p.coords.longitude }).catch(() => {})
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [onDuty])

  // keep screen on while on duty
  useEffect(() => {
    if (!onDuty || !('wakeLock' in navigator)) return
    let lock: any = null
    const get = () => (navigator as any).wakeLock.request('screen').then((l: any) => { lock = l }).catch(() => {})
    get()
    const onVis = () => { if (document.visibilityState === 'visible') get() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.() }
  }, [onDuty])

  // ring for a new visit until accepted
  useEffect(() => {
    if (!active || active.status !== 'assigned') return
    if (alerted.current !== active.id) {
      alerted.current = active.id
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('New Razano Rapid visit', { body: `${active.services.map(s => s.name).join(' + ')} • Sector ${active.sector}` }) } catch { /* ignore */ }
    }
    beep()
    const id = setInterval(beep, 4000)
    return () => clearInterval(id)
  }, [active?.id, active?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDuty = async () => {
    unlockAudio()
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
    setDutyBusy(true)
    try { setH(await rpc<Home>('rr_set_duty', { p_on: !onDuty })); refresh() }
    catch (e) { toast.error((e as Error).message) } finally { setDutyBusy(false) }
  }

  const step = async (b: Booking, s: string) => {
    unlockAudio()
    try {
      const r = await rpc<Booking>('rr_nurse_step', { p_id: b.id, p_step: s })
      if (s === 'accept' && lastPos.current) rpc('rr_nurse_ping', { p_lat: lastPos.current[0], p_lng: lastPos.current[1] }).catch(() => {})
      if (s === 'accept' && b.lat != null && b.lng != null) window.open(`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=two-wheeler`, '_blank')
      if (s === 'start' || s === 'start_no_injection') setVitalsFor(r)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  if (!h) return <TabPage><div className="flex justify-center pt-16 text-primary"><Spinner className="text-[32px]" /></div></TabPage>
  const me = h.me
  const sectors = me.sectors && me.sectors.length ? `Sectors ${me.sectors.join(', ')}` : 'Sectors 47–57'

  return (
    <TabPage>
      <div className="px-margin-mobile pt-2 flex flex-col gap-space-md">
        {/* Duty + earnings */}
        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
          <div className="flex items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-xs min-w-0">
              <span className="relative flex h-3 w-3 flex-shrink-0">
                {onDuty && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-fixed-dim opacity-75" />}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${onDuty ? 'bg-secondary' : 'bg-outline'}`} />
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-headline-sm text-headline-sm text-on-surface truncate">{onDuty ? 'On-Duty' : 'Standby'}</span>
                  <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded-full font-bold ${onDuty ? 'bg-verified-emerald-light text-secondary' : 'bg-surface-container text-outline'}`}>RAPID</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{me.name} • {sectors}, GGN</span>
              </div>
            </div>
            <button aria-label="Toggle Duty Mode" onClick={toggleDuty} disabled={dutyBusy}
              className={`w-16 h-9 rounded-full p-1 flex items-center transition-all duration-300 shadow-inner flex-shrink-0 ${onDuty ? 'bg-secondary-container justify-end' : 'bg-surface-variant justify-start'}`}>
              <div className={`w-7 h-7 rounded-full shadow-md flex items-center justify-center ${onDuty ? 'bg-on-secondary text-secondary' : 'bg-white text-outline'}`}>
                {dutyBusy ? <Spinner className="text-[16px]" /> : <Icon name="medical_services" className="text-[18px]" />}
              </div>
            </button>
          </div>
          <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <div className="w-8 h-8 rounded-full bg-primary-container/10 flex items-center justify-center text-primary"><Icon name="payments" className="text-[20px]" /></div>
              <div>
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant block">Today's Incentive</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{rupees(h.today_completed * h.incentive)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-surface-container-lowest px-2.5 py-1 rounded-full shadow-sm">
              <Icon name="task_alt" className="text-[16px] text-secondary" />
              <span className="font-label-md text-label-md text-on-surface">{h.today_completed} completed</span>
            </div>
          </div>
          {!onDuty && <p className="font-body-sm text-body-sm text-on-surface-variant">Switch on to receive visits. Keep this app open — it rings for new visits and shares your location with the family while you ride.</p>}
        </section>

        {active ? <ActiveCard b={active} myPos={myPos} onStep={step} onVitals={() => setVitalsFor(active)} /> : onDuty && (
          <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-verified-emerald-light text-secondary flex items-center justify-center"><Icon name="radar" className="text-[26px] animate-pulse" /></div>
            <div>
              <div className="font-headline-sm text-headline-sm">Waiting for the next visit</div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Phone will ring when a family books. Keep the screen on.</p>
            </div>
          </section>
        )}

        {active && active.needs_rx && ['accepted', 'arrived'].includes(active.status) && (
          <SafetyProtocol b={active} onChanged={load} onStart={s => step(active, s)} />
        )}

        {h.upcoming.length > 0 && (
          <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Upcoming Visits</h2>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold">{h.upcoming.length}</span>
            </div>
            {h.upcoming.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-space-sm rounded-lg bg-surface-container-low">
                <div className="text-center flex-shrink-0 w-16">
                  <div className="font-label-lg text-label-lg text-primary">{timeLabel(u.scheduled_at)}</div>
                  <div className="font-label-sm text-label-sm text-outline">{dateTimeLabel(u.scheduled_at).split(',')[0]}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-label-lg text-label-lg text-on-surface truncate">{u.patient.name} ({u.patient.age})</div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{u.services.map(s => s.name).join(' + ')} • Sec {u.sector}</div>
                </div>
                {u.customer && <a href={telLink(u.customer.phone)} aria-label="Call family" className="w-9 h-9 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center"><Icon name="call" className="text-[18px]" /></a>}
              </div>
            ))}
          </section>
        )}

        {h.recent.some(r => r.pay_status !== 'paid') && (
          <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Payment Pending</h2>
            {h.recent.filter(r => r.pay_status !== 'paid').map(r => <UnpaidRow key={r.id} r={r} onDone={load} />)}
          </section>
        )}

        <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between gap-space-sm mb-4">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><Icon name="inventory_2" className="text-[20px]" /></div>
            <div>
              <span className="font-label-md text-label-md text-on-surface block">Nurse Kit</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Running low? Ask for a restock at half.</span>
            </div>
          </div>
          <a href={waLink(RAZANO_WHATSAPP, `Kit restock request from ${me.name}:\n- Needles:\n- Syringes:\n- Gloves:\n- Gluco strips:\n- Dressing kits:\n- Other:`)} target="_blank" rel="noreferrer"
            className="font-label-sm text-label-sm px-2 py-1 rounded bg-surface-container-high text-primary font-bold">RESTOCK</a>
        </section>
      </div>
      <VitalsSheet b={vitalsFor} onClose={() => setVitalsFor(null)} onDone={() => { setVitalsFor(null); load() }} />
    </TabPage>
  )
}

function ActiveCard({ b, myPos, onStep, onVitals }: { b: Booking; myPos: [number, number] | null; onStep: (b: Booking, s: string) => Promise<void>; onVitals: () => void }) {
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  const run = async (s: string) => { setBusy(true); await onStep(b, s); setBusy(false) }
  const left = b.assigned_at ? Math.max(0, 60 - Math.floor((now - new Date(b.assigned_at).getTime()) / 1000)) : 0
  const km = b.lat != null && b.lng != null && myPos ? kmBetween(myPos, [b.lat, b.lng]) : null
  const pill = b.status === 'assigned' ? { cls: 'bg-error-container text-on-error-container animate-pulse', text: 'NEW VISIT', icon: 'bolt' }
    : b.status === 'accepted' ? { cls: 'bg-primary-fixed text-on-primary-fixed', text: 'ON THE WAY', icon: 'moped' }
    : b.status === 'arrived' ? { cls: 'bg-verified-emerald-light text-secondary', text: 'AT HOME', icon: 'door_front' }
    : { cls: 'bg-verified-emerald-light text-secondary', text: 'IN PROCEDURE', icon: 'vital_signs' }
  const due = b.mode === 'scheduled' ? `Due ${timeLabel(b.scheduled_at)}` : null
  const mapsUrl = b.lat != null && b.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=two-wheeler`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(b.address))}`

  return (
    <section className={`relative overflow-hidden bg-surface-container-lowest rounded-xl shadow-md transition-all ${b.status !== 'assigned' ? 'ring-2 ring-secondary' : ''}`}>
      {b.status === 'assigned' && (
        <div className="h-1.5 w-full bg-surface-container">
          <div className="h-full bg-vital-red transition-all duration-1000 ease-linear" style={{ width: `${(left / 60) * 100}%` }} />
        </div>
      )}
      <div className="p-space-md flex flex-col gap-space-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-space-xs min-w-0">
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase font-bold flex items-center gap-1 flex-shrink-0 ${pill.cls}`}>
              <Icon name={pill.icon} className="text-[14px]" />{pill.text}
            </span>
            <span className="font-label-md text-label-md text-primary font-bold truncate">{b.services.map(s => s.name).join(' + ')}</span>
          </div>
          {b.status === 'assigned' && (
            <div className="flex items-center gap-1 bg-amber-warning-light text-tertiary-container px-2 py-0.5 rounded-full font-label-sm text-label-sm font-bold flex-shrink-0">
              <Icon name="timer" className="text-[14px]" /><span>{due ?? (left > 0 ? `Accept within ${left}s` : 'Accept now')}</span>
            </div>
          )}
        </div>

        <a href={mapsUrl} target="_blank" rel="noreferrer" className="bg-surface-container-low rounded-lg p-space-sm flex items-start justify-between gap-space-sm active:scale-[0.99] transition-transform">
          <div className="flex items-start gap-space-xs min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0 mt-0.5"><Icon name="pin_drop" className="text-[18px]" /></div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">{b.address.line1}, {b.address.line2}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{addressLine({ line1: '', line2: null, sector: b.address.sector }).replace(/^, /, '')}{b.address.landmark ? ` • ${b.address.landmark}` : ''}</span>
            </div>
          </div>
          {km != null && (
            <div className="text-right flex-shrink-0">
              <span className="font-label-lg text-label-lg text-secondary block">{bikeEta(km)} mins</span>
              <span className="font-body-sm text-body-sm text-outline">{km.toFixed(1)} km away</span>
            </div>
          )}
          {km == null && <span className="flex items-center gap-1 text-primary font-label-md text-label-md flex-shrink-0"><Icon name="directions" className="text-[18px]" />Directions</span>}
        </a>

        <div className="flex items-center justify-between gap-space-sm pt-1">
          <div className="flex items-center gap-space-xs min-w-0">
            <Avatar name={b.patient.name} className="w-10 h-10" />
            <div className="flex flex-col min-w-0">
              <span className="font-label-lg text-label-lg text-on-surface truncate">{b.patient.name} ({b.patient.age}{b.patient.gender ? ' ' + b.patient.gender : ''})</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                <Icon name="medication" className="text-[14px] text-primary" /><span className="line-clamp-2">{b.patient.notes || 'No medical notes'}</span>
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 bg-verified-emerald-light px-3 py-1.5 rounded-lg">
            <span className="font-label-sm text-label-sm text-secondary uppercase block">Incentive</span>
            <span className="font-headline-sm text-headline-sm text-secondary font-extrabold">{rupees(b.incentive ?? 40)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {b.customer && <a href={telLink(b.customer.phone)} className="h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center gap-1 font-label-md text-label-md"><Icon name="call" className="text-[16px]" />Family</a>}
          {b.customer && <a href={waLink(b.customer.phone, `Namaste, main Razano Rapid se nurse bol raha/rahi hoon — visit ${b.ref} ke liye.`)} target="_blank" rel="noreferrer" className="h-10 rounded-full bg-verified-emerald-light text-secondary flex items-center justify-center gap-1 font-label-md text-label-md"><Icon name="chat" className="text-[16px]" />WhatsApp</a>}
          <a href={mapsUrl} target="_blank" rel="noreferrer"
            className="h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center gap-1 font-label-md text-label-md"><Icon name="navigation" className="text-[16px]" />Map</a>
        </div>
        <div className="font-body-sm text-body-sm text-outline">{b.ref} • {b.pay_status === 'paid' ? 'Paid online' : `Collect ${rupees(b.total)} after visit`}{b.needs_rx ? ' • Prescription check needed' : ''}</div>

        {b.status === 'assigned' && (
          <PrimaryButton busy={busy} onClick={() => run('accept')} className="mt-1">
            <Icon name="check_circle" className="text-[22px]" /><span>Accept Visit • Begin Fast Route</span>
          </PrimaryButton>
        )}
        {b.status === 'accepted' && (
          <PrimaryButton busy={busy} onClick={() => run('arrive')} className="mt-1">
            <Icon name="door_front" className="text-[22px]" /><span>I've Arrived at the Door</span>
          </PrimaryButton>
        )}
        {b.status === 'arrived' && !b.needs_rx && (
          <PrimaryButton tone="secondary" busy={busy} onClick={() => run('start')} className="mt-1">
            <Icon name="play_circle" className="text-[22px]" /><span>Begin Procedure & Record Vitals</span>
          </PrimaryButton>
        )}
        {b.status === 'in_progress' && (
          <PrimaryButton tone="secondary" onClick={onVitals} className="mt-1">
            <Icon name="vital_signs" className="text-[22px]" /><span>Record Vitals & Complete Visit</span>
          </PrimaryButton>
        )}
      </div>
    </section>
  )
}

const CHECKS = (b: Booking) => [
  ["1. Doctor's Name, Reg. No. & Signature", 'Registration number and signature/stamp on the prescription'],
  ['2. Patient Name & Age Match', `${b.patient.name}, ${b.patient.age} yrs matches the prescription`],
  ['3. Dated & Course Still Running', 'Date and duration written by the doctor are current'],
  ['4. Medicine, Dose, Route, Frequency, Duration', 'All written clearly and match what you will give'],
  ['5. Medicine in the House Matches', 'Name, strength, expiry date & seal checked'],
]

function SafetyProtocol({ b, onChanged, onStart }: { b: Booking; onChanged: () => void; onStart: (s: string) => Promise<void> }) {
  const rx = b.rx
  const [checks, setChecks] = useState<boolean[]>(rx?.checks || [false, false, false, false, false])
  const [img, setImg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { setChecks(rx?.checks || [false, false, false, false, false]) }, [rx?.checks?.join(), rx?.uploaded_at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!rx?.has_image) { setImg(null); return }
    rpc<{ image: string } | null>('rr_rx_get', { p_id: b.id }).then(r => setImg(r?.image || null)).catch(() => {})
  }, [b.id, rx?.has_image, rx?.uploaded_at])

  const count = checks.filter(Boolean).length
  const unlocked = rx?.status === 'clear' || rx?.status === 'doctor_ok'
  const gp = GP_WHATSAPP || RAZANO_WHATSAPP

  const toggle = async (i: number) => {
    if (!rx?.has_image) return toast.error('Take the prescription photo first')
    const next = checks.map((c, j) => (j === i ? !c : c))
    setChecks(next)
    try { await rpc('rr_rx_check', { p_id: b.id, p_checks: next }); onChanged() } catch (e) { toast.error((e as Error).message) }
  }
  const upload = async (f: File) => {
    setBusy(true)
    try { await rpc('rr_rx_upload', { p_id: b.id, p_image: await compressImage(f) }); toast.success('Prescription photo saved'); onChanged() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const askText = `Rx check needed — ${b.ref}\nPatient: ${b.patient.name}, ${b.patient.age}${b.patient.gender ? ' ' + b.patient.gender : ''}\nNotes: ${b.patient.notes || '-'}\nServices: ${b.services.map(s => s.name).join(', ')}\nUnclear point: `

  return (
    <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name="verified_user" className="text-[20px] text-primary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">5-Point Safety Protocol</h2>
          </div>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-verified-emerald-light text-secondary font-bold">MANDATORY</span>
        </div>
        <div className="rounded-lg bg-amber-warning-light p-space-sm flex items-start gap-space-xs">
          <Icon name="lock_clock" className="text-[20px] text-tertiary-container flex-shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-tertiary-container font-bold">Critical Safety Gate</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant leading-snug">Injection stays locked until all 5 checks pass, or the doctor gives an OK. No IV, no medicines from our side.</span>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <Icon name="description" className="text-[20px] text-primary" />
            <span className="font-label-md text-label-md text-on-surface">Prescription Photo</span>
          </div>
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <button onClick={() => input.current?.click()} aria-label="Take Rx photo" className="flex items-center gap-1 text-primary active:scale-95 transition-transform">
            {busy ? <Spinner className="text-[16px]" /> : <Icon name="photo_camera" className="text-[16px]" />}
            <span className="font-label-md text-label-md underline">{rx?.has_image ? 'Retake Photo' : 'Take Photo'}</span>
          </button>
        </div>
        <div className="flex gap-space-sm items-center">
          {img ? <a href={img} target="_blank" rel="noreferrer"><img className="w-16 h-16 rounded-lg object-cover shadow-sm flex-shrink-0" src={img} alt="Prescription" /></a>
            : <div className="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center text-outline flex-shrink-0"><Icon name="add_a_photo" className="text-[24px]" /></div>}
          <div className="flex flex-col min-w-0">
            {rx?.status === 'doctor_ok' ? (<>
              <div className="flex items-center gap-1"><Icon name="verified" className="text-[16px] text-secondary" /><span className="font-label-md text-label-md text-secondary truncate">Approved by {rx.doctor_name}</span></div>
              <span className="font-body-sm text-body-sm text-on-surface line-clamp-2">{rx.doctor_note}</span>
            </>) : rx?.status === 'doctor_no' ? (<>
              <div className="flex items-center gap-1"><Icon name="block" className="text-[16px] text-error" /><span className="font-label-md text-label-md text-error truncate">Doctor said NO — don't inject</span></div>
              <span className="font-body-sm text-body-sm text-on-surface line-clamp-2">{rx.doctor_name}: {rx.doctor_note}</span>
            </>) : rx?.has_image ? (<>
              <span className="font-label-md text-label-md text-on-surface">{rx.uploaded_by === 'customer' ? 'Uploaded by family' : 'Photo taken by you'}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Tick each check after reading the prescription</span>
            </>) : <span className="font-body-sm text-body-sm text-on-surface-variant">Take a clear photo of the doctor's prescription first.</span>}
            {rx?.uploaded_at && <span className="font-label-sm text-label-sm text-outline mt-0.5">Ref: {b.ref} • {timeLabel(rx.uploaded_at)}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-space-xs">
        {CHECKS(b).map(([t, sub], i) => (
          <label key={i} className={`flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors min-h-[48px] ${!rx?.has_image ? 'opacity-60' : ''}`}>
            <input type="checkbox" checked={!!checks[i]} onChange={() => toggle(i)} className="mt-1 w-5 h-5 rounded accent-primary cursor-pointer flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-label-lg text-label-lg text-on-surface">{t}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{sub}</span>
            </div>
          </label>
        ))}
      </div>

      <div className={`rounded p-2 flex items-center justify-between ${unlocked ? 'bg-verified-emerald-light' : 'bg-amber-warning-light'}`}>
        <div className={`flex items-center gap-1.5 ${unlocked ? 'text-secondary' : 'text-tertiary-container'}`}>
          <Icon name={unlocked ? 'lock_open' : 'lock'} className="text-[18px]" />
          <span className="font-label-md text-label-md font-bold">{unlocked ? 'Injection Lock Disengaged' : 'Injection Locked'}</span>
        </div>
        <span className={`font-label-sm text-label-sm font-bold ${unlocked ? 'text-secondary' : 'text-tertiary-container'}`}>{rx?.status === 'doctor_ok' ? 'Doctor OK' : `${count}/5 Verified`}</span>
      </div>

      {b.status === 'arrived' ? (
        <PrimaryButton tone="secondary" disabled={!unlocked} onClick={() => onStart('start')}>
          <Icon name="play_circle" className="text-[22px]" /><span>Begin Procedure & Record Vitals</span>
        </PrimaryButton>
      ) : (
        <div className="font-body-sm text-body-sm text-on-surface-variant text-center">Tap “I've Arrived” when you reach, then complete the checks.</div>
      )}
      {b.status === 'arrived' && !unlocked && (
        <button onClick={() => { if (confirm('Skip the injection and do only the other care? The family will be told the injection was not given.')) onStart('start_no_injection') }}
          className="font-label-md text-label-md text-on-surface-variant underline">Can't verify — skip injection, do other care only</button>
      )}

      <div className="flex items-center justify-between pt-1 gap-2">
        <a href={waLink(gp, askText)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm">
          <Icon name="help" className="text-[16px]" /><span>Dosage Clarification</span>
        </a>
        <a href={telLink(gp.slice(-10))} className="flex items-center gap-1 text-vital-red font-label-md text-label-md active:scale-95 transition-transform">
          <Icon name="support_agent" className="text-[16px]" /><span>Call {GP_NAME || (GP_WHATSAPP ? 'Doctor' : 'Razano')} Directly</span>
        </a>
      </div>
      {rx?.has_image && rx.status !== 'clear' && (
        <button onClick={() => setDocOpen(true)} className="h-11 rounded-lg border-[1.5px] border-primary-container text-primary-container font-label-lg text-label-lg">Record the doctor's answer</button>
      )}
      <DoctorSheet open={docOpen} onClose={() => setDocOpen(false)} b={b} onDone={() => { setDocOpen(false); onChanged() }} />
    </section>
  )
}

function DoctorSheet({ open, onClose, b, onDone }: { open: boolean; onClose: () => void; b: Booking; onDone: () => void }) {
  const [doc, setDoc] = useState(GP_NAME)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (ok: boolean) => {
    setBusy(true)
    try { await rpc('rr_rx_doctor', { p_id: b.id, p_doctor: doc, p_note: note, p_ok: ok }); toast.success(ok ? 'Doctor OK recorded' : 'Recorded — do not inject'); onDone() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Doctor's answer">
      <div className="flex flex-col gap-3">
        <Field label="Doctor's name"><input className="field" value={doc} onChange={e => setDoc(e.target.value)} placeholder="Dr. ..." /></Field>
        <Field label="What the doctor said (exact)"><textarea className="field" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. OK to give Inj. ___ 1 amp IM once, as written" /></Field>
        <PrimaryButton tone="secondary" busy={busy} onClick={() => save(true)}><Icon name="check" className="text-[20px]" />Doctor said OK — unlock</PrimaryButton>
        <PrimaryButton tone="danger" busy={busy} onClick={() => save(false)}><Icon name="block" className="text-[20px]" />Doctor said do NOT give</PrimaryButton>
      </div>
    </Sheet>
  )
}

function VitalsSheet({ b, onClose, onDone }: { b: Booking | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (b) setF({
      bp_sys: '', bp_dia: '', sugar: '', sugar_context: 'Random', pulse: '', spo2: '', temp: '',
      procedure_note: b.services.filter(s => !(b.injection_skipped && s.needs_rx)).map(s => s.name).join(' + ') + (b.injection_skipped ? ' (injection NOT given — prescription not verified)' : ''),
      consumables: '', nurse_notes: '', collected: b.pay_status === 'paid' ? 'paid' : '',
    })
  }, [b?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) return null
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const n = (k: string) => (f[k] ? Number(f[k]) : null)
  const alerts: { level: 'red' | 'amber'; text: string }[] = []
  const spo2 = n('spo2'), sys = n('bp_sys'), dia = n('bp_dia'), sugar = n('sugar')
  if (spo2 != null && spo2 < 90) alerts.push({ level: 'red', text: `SpO2 below 90 — call ${EMERGENCY} now.` })
  if ((sys != null && sys > 180) || (dia != null && dia > 110)) alerts.push({ level: 'amber', text: 'BP above 180/110 — call the doctor before leaving.' })
  if (sugar != null && (sugar < 70 || sugar > 300)) alerts.push({ level: 'amber', text: 'Sugar below 70 or above 300 — call the doctor.' })

  const submit = async () => {
    if (!f.collected) return toast.error('Choose how payment was handled')
    setBusy(true)
    try {
      await rpc('rr_nurse_complete', { p_id: b.id, p: {
        vitals: { bp_sys: f.bp_sys, bp_dia: f.bp_dia, sugar: f.sugar, sugar_context: f.sugar ? f.sugar_context : '', pulse: f.pulse, spo2: f.spo2, temp: f.temp },
        procedure_note: f.procedure_note, consumables: f.consumables, nurse_notes: f.nurse_notes,
        collected: f.collected === 'upi' || f.collected === 'cash' ? f.collected : null,
      } })
      toast.success('Visit completed. Report sent to family.')
      onDone()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const num = (k: string, label: string, ph: string) => <Field label={label}><input className="field" inputMode="decimal" value={f[k] || ''} onChange={set(k)} placeholder={ph} /></Field>

  return (
    <Sheet open={!!b} onClose={onClose} title="Record vitals & complete" tall
      footer={<PrimaryButton tone="secondary" busy={busy} onClick={submit}><Icon name="task_alt" className="text-[22px]" /><span>Complete Visit</span></PrimaryButton>}>
      <div className="flex flex-col gap-3">
        <div className="font-body-sm text-body-sm text-on-surface-variant">{b.patient.name} ({b.patient.age}) • {b.ref}</div>
        <div className="grid grid-cols-2 gap-3">
          {num('bp_sys', 'BP systolic (upper)', '120')}
          {num('bp_dia', 'BP diastolic (lower)', '80')}
          {num('sugar', 'Blood sugar mg/dL', '140')}
          <Field label="Sugar taken">
            <select className="field" value={f.sugar_context} onChange={set('sugar_context')}>
              <option>Random</option><option>Fasting</option><option>Post-meal (2h)</option>
            </select>
          </Field>
          {num('pulse', 'Pulse (bpm)', '74')}
          {num('spo2', 'SpO2 %', '98')}
          {num('temp', 'Temperature °F', '98.4')}
        </div>
        {alerts.map((a, i) => (
          <div key={i} className={`rounded-lg p-3 flex gap-2 font-label-md text-label-md ${a.level === 'red' ? 'bg-vital-red text-white' : 'bg-amber-warning-light text-tertiary-container'}`}>
            <Icon name="warning" className="text-[20px]" />{a.text}
          </div>
        ))}
        <Field label="Procedure done (what, dose, site)"><textarea className="field" value={f.procedure_note || ''} onChange={set('procedure_note')} placeholder="e.g. Inj. Insulin Glargine 12 U SC, left abdomen" /></Field>
        <Field label="Sterile consumables used"><input className="field" value={f.consumables || ''} onChange={set('consumables')} placeholder="e.g. 4mm needle, alcohol swab, gloves" /></Field>
        <Field label="Notes for the family"><textarea className="field" value={f.nurse_notes || ''} onChange={set('nurse_notes')} placeholder="e.g. Comfortable, no swelling. Next dose 8 PM." /></Field>
        <div className="flex flex-col gap-2">
          <span className="field-label">Payment ({rupees(b.total)})</span>
          {b.pay_status === 'paid' ? <div className="rounded-lg bg-verified-emerald-light text-secondary p-3 font-label-md text-label-md">Already paid online</div> :
            ([['upi', 'Collected by UPI (to Razano)'], ['cash', 'Collected in cash'], ['later', 'Family will pay online later']] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setF({ ...f, collected: v })}
                className={`rounded-lg p-3 flex items-center gap-2 text-left border ${f.collected === v ? 'border-2 border-primary-container bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-surface-container-lowest'}`}>
                <Icon name={f.collected === v ? 'radio_button_checked' : 'radio_button_unchecked'} className="text-[20px] text-primary-container" />
                <span className="font-label-lg text-label-lg">{t}</span>
              </button>
            ))}
        </div>
      </div>
    </Sheet>
  )
}

function UnpaidRow({ r, onDone }: { r: Home['recent'][number]; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const mark = async (via: 'upi' | 'cash') => {
    setBusy(true)
    try { await rpc('rr_nurse_mark_paid', { p_id: r.id, p_via: via }); onDone() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center justify-between gap-2 p-space-sm rounded-lg bg-surface-container-low">
      <div className="min-w-0">
        <div className="font-label-lg text-label-lg truncate">{r.patient.name} • {rupees(r.total)}</div>
        <div className="font-body-sm text-body-sm text-on-surface-variant">{r.ref} • {r.pay_status === 'claimed' ? 'Family says paid online' : 'Not paid'}</div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button disabled={busy} onClick={() => mark('cash')} className="px-2 h-8 rounded bg-surface-container-high text-primary font-label-sm text-label-sm">CASH</button>
        <button disabled={busy} onClick={() => mark('upi')} className="px-2 h-8 rounded bg-verified-emerald-light text-secondary font-label-sm text-label-sm">UPI</button>
      </div>
    </div>
  )
}
