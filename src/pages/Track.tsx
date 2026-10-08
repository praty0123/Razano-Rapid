import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { TabPage } from '../components/AppShell'
import { TrackMap, type TrackMapHandle } from '../components/TrackMap'
import { UpiPayCard } from '../components/UpiPay'
import { Avatar, EmptyCard, Icon, PrimaryButton, Sheet, Spinner } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll } from '../lib/useInterval'
import { liveEta } from '../lib/eta'
import { compressImage } from '../lib/image'
import { EMERGENCY, GP_NAME } from '../lib/config'
import { agoLabel, dateTimeLabel, firstName, rupees, telLink, timeLabel, waLink } from '../lib/format'
import type { Booking } from '../lib/types'

export default function Track() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const { user, ready, active, requireAuth, refreshActive } = useSession()
  const [b, setB] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(sp.get('pay') === '1')
  const [cancelOpen, setCancelOpen] = useState(false)
  const mapRef = useRef<TrackMapHandle>(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const r = id ? await rpc<Booking>('rr_booking', { p_id: id }) : await rpc<Booking | null>('rr_my_active')
      setB(r)
    } catch (e) { if (id) toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [id, user])
  usePoll(load, 8000, !!user)
  useEffect(() => { if (!id && active && !b) setB(active) }, [id, active, b])

  if (ready && !user) {
    return <TabPage><div className="px-margin-mobile pt-4">
      <EmptyCard icon="moped" title="Track your nurse live" text="Log in to see your nurse on the map and get live updates."
        action={<PrimaryButton onClick={() => requireAuth().catch(() => {})}>Log in</PrimaryButton>} />
    </div></TabPage>
  }
  if (loading && !b) return <TabPage><div className="flex justify-center pt-16 text-primary"><Spinner className="text-[32px]" /></div></TabPage>
  if (!b) {
    return <TabPage><div className="px-margin-mobile pt-4 flex flex-col gap-3">
      <EmptyCard icon="moped" title="No active visit" text="Book a nurse and you can watch them arrive here, live."
        action={<PrimaryButton onClick={() => nav('/')}>Book a nurse</PrimaryButton>} />
      <Link to="/records" className="text-center font-label-lg text-label-lg text-primary py-2">See past visits</Link>
    </div></TabPage>
  }

  const eta = liveEta(b)
  const n = b.nurse
  const home: [number, number] | null = b.lat != null && b.lng != null ? [b.lat, b.lng] : null
  const nursePos: [number, number] | null = n && n.lat != null && n.lng != null && (b.status === 'accepted' || b.status === 'arrived') ? [n.lat, n.lng] : null
  const closed = b.status === 'completed' || b.status === 'cancelled'
  const canCancel = ['waiting', 'assigned', 'accepted'].includes(b.status)
  const statusBadge = b.status === 'waiting' ? 'Finding your nurse' : b.status === 'accepted' ? 'Nurse on the way'
    : b.status === 'arrived' || b.status === 'in_progress' ? 'Nurse at home' : b.mode === 'now' ? 'Rapid dispatch' : 'Scheduled visit'

  return (
    <TabPage>
      {/* Live map */}
      <div className="rr-track relative isolate w-full h-80 overflow-hidden bg-surface-container-low shadow-sm">
        <TrackMap ref={mapRef} home={home} nurse={nursePos} etaText={nursePos && eta.min ? `ETA ${eta.min} Mins` : null} />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/30 via-transparent to-surface/90 pointer-events-none z-[400]" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-[700] pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/95 backdrop-blur-md shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
            <span className="w-2 h-2 rounded-full bg-secondary -ml-3" />
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">{statusBadge}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-full bg-surface/90 backdrop-blur-md text-on-surface shadow-md flex items-center gap-1">
            <Icon name="satellite_alt" className="text-[16px] text-primary" />
            <span className="font-label-sm text-label-sm text-outline">{nursePos && n?.loc_at ? `Live GPS • ${agoLabel(n.loc_at)}` : `Sector ${b.sector ?? ''}`}</span>
          </div>
        </div>
        <div className="absolute right-4 bottom-5 flex flex-col gap-2 z-[700]">
          <button aria-label="Locate nurse" onClick={() => mapRef.current?.focusNurse()} className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface shadow-md flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="my_location" className="text-[20px] text-primary" />
          </button>
          <button aria-label="Center route" onClick={() => mapRef.current?.fitRoute()} className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface shadow-md flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="route" className="text-[20px] text-outline" />
          </button>
        </div>
      </div>

      <div className="px-margin-mobile flex flex-col gap-space-md -mt-4 z-20 relative">
        {/* Sterile kit assurance */}
        <div className="w-full bg-verified-emerald-light rounded-xl p-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0">
              <Icon name="sanitizer" className="text-[16px]" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-secondary">Sealed sterile kit • Single-use</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Opened in front of you at the bedside</span>
            </div>
          </div>
          <span className="font-label-sm text-label-sm font-bold px-2 py-0.5 rounded-full bg-surface-container-lowest text-secondary flex-shrink-0">{b.ref}</span>
        </div>

        {closed && (
          <div className={`rounded-xl p-4 shadow-sm flex items-center gap-3 ${b.status === 'completed' ? 'bg-verified-emerald-light' : 'bg-error-container'}`}>
            <Icon name={b.status === 'completed' ? 'check_circle' : 'cancel'} fill className={`text-[28px] ${b.status === 'completed' ? 'text-secondary' : 'text-on-error-container'}`} />
            <div className="flex-1">
              <div className="font-headline-sm text-headline-sm">{b.status === 'completed' ? 'Visit completed' : 'Visit cancelled'}</div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{b.status === 'completed' ? 'Vitals and notes are ready in your report.' : b.cancel_reason || 'This visit was cancelled.'}</p>
            </div>
            {b.status === 'completed' && <Link to={`/visit/${b.id}`} className="px-3 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md">Report</Link>}
          </div>
        )}

        {/* Assigned nurse card */}
        {n ? (
          <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm">
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex gap-space-sm items-center min-w-0">
                <div className="relative flex-shrink-0">
                  <Avatar name={n.name} photo={n.photo} className="w-16 h-16 shadow-sm" textClass="text-headline-sm" />
                  {n.verified && <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-xs">
                    <Icon name="verified" className="text-[14px] font-bold" />
                  </span>}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{n.name}</span>
                    {n.verified && <span className="font-label-sm text-label-sm text-secondary bg-verified-emerald-light px-2 py-0.5 rounded-full font-bold">Verified</span>}
                  </div>
                  <span className="font-body-sm text-body-sm text-outline truncate">{[n.qualification, n.reg_no ? `Reg #${n.reg_no}` : null].filter(Boolean).join(' • ') || 'Razano Rapid nurse'}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {n.rating_count > 0 ? (<>
                      <Icon name="star" fill className="text-[16px] text-tertiary" />
                      <span className="font-label-md text-label-md text-on-surface">{n.rating_avg}</span>
                      <span className="font-body-sm text-body-sm text-outline">({n.visits} Rapid visit{n.visits === 1 ? '' : 's'})</span>
                    </>) : <span className="font-body-sm text-body-sm text-outline">New on Razano Rapid</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                {b.status === 'accepted' && eta.min != null ? (<>
                  <span className="font-headline-md text-headline-md text-primary font-bold">{eta.min}<span className="font-label-sm text-label-sm text-primary uppercase ml-0.5">min</span></span>
                  {eta.km != null && <span className="font-label-sm text-label-sm text-outline">Distance {eta.km} km</span>}
                </>) : b.status === 'assigned' && b.mode === 'scheduled' ? (<>
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">{timeLabel(b.scheduled_at)}</span>
                  <span className="font-label-sm text-label-sm text-outline">{dateTimeLabel(b.scheduled_at).split(',')[0]}</span>
                </>) : null}
              </div>
            </div>
            {n.vehicle && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low text-on-surface">
                <Icon name="two_wheeler" className="text-[20px] text-primary flex-shrink-0" />
                <div className="flex items-center justify-between w-full min-w-0">
                  <span className="font-body-sm text-body-sm truncate">{n.vehicle}</span>
                  <span className="font-label-sm text-label-sm text-primary flex-shrink-0 font-bold">Razano Kit</span>
                </div>
              </div>
            )}
            {!closed && (
              <div className="grid grid-cols-2 gap-space-sm pt-1">
                <a className="h-11 rounded-full bg-surface-container-high text-primary flex items-center justify-center gap-1.5 active:scale-95 transition-transform" href={telLink(n.phone)}>
                  <Icon name="call" className="text-[18px]" /><span className="font-label-lg text-label-lg">Call Nurse</span>
                </a>
                <a className="h-11 rounded-full bg-verified-emerald-light text-secondary flex items-center justify-center gap-1.5 active:scale-95 transition-transform" target="_blank" rel="noreferrer"
                  href={waLink(n.phone, `Hi ${firstName(n.name)}, this is about Razano Rapid visit ${b.ref} for ${b.patient.name}.`)}>
                  <Icon name="chat" className="text-[18px]" /><span className="font-label-lg text-label-lg">WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        ) : !closed && (
          <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-md flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-warning-light text-tertiary-container flex items-center justify-center flex-shrink-0"><Spinner className="text-[26px]" /></div>
            <div>
              <div className="font-headline-sm text-headline-sm text-on-surface">Finding your nurse</div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {b.mode === 'scheduled' ? `Visit on ${dateTimeLabel(b.scheduled_at)}. We'll confirm the nurse soon.` : 'Our team has your request and is assigning a nurse. We may call you.'}
              </p>
            </div>
          </div>
        )}

        {b.pay_method === 'now' && b.pay_status === 'unpaid' && b.status !== 'cancelled' && (
          <button onClick={() => setPayOpen(true)} className="w-full bg-surface-container-lowest rounded-xl p-3 shadow-sm flex items-center justify-between active:scale-[0.99]">
            <div className="flex items-center gap-2"><Icon name="account_balance_wallet" className="text-[22px] text-primary" /><span className="font-label-lg text-label-lg">Pay {rupees(b.total)} by UPI</span></div>
            <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">Pay now</span>
          </button>
        )}

        <Progress b={b} etaMin={eta.min} km={eta.km} />

        {!closed && <RxCard b={b} onUpdated={setB} />}

        {canCancel && (
          <button onClick={() => setCancelOpen(true)} className="font-label-md text-label-md text-on-surface-variant underline py-1">Cancel this visit</button>
        )}

        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-low mb-4">
          <div className="flex items-center gap-2">
            <Icon name="emergency_home" className="text-[20px] text-error" />
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface">Sudden Condition Deterioration?</span>
              <span className="font-body-sm text-body-sm text-outline">Call an ambulance now, don't wait</span>
            </div>
          </div>
          <a className="px-3 py-1.5 rounded-full bg-vital-red text-on-error font-label-md text-label-md flex items-center gap-1 active:scale-95 transition-transform flex-shrink-0" href={`tel:${EMERGENCY}`}>
            <span>SOS {EMERGENCY}</span>
          </a>
        </div>
      </div>

      <Sheet open={payOpen} onClose={() => { setPayOpen(false); if (sp.get('pay')) { sp.delete('pay'); setSp(sp, { replace: true }) } }} title={`Pay for ${b.ref}`}>
        <UpiPayCard flat booking={b} onUpdated={x => { setB(x); setPayOpen(false) }} />
      </Sheet>
      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} b={b} onDone={x => { setB(x); refreshActive() }} />
    </TabPage>
  )
}

function Progress({ b, etaMin, km }: { b: Booking; etaMin: number | null; km: number | null }) {
  const n = b.nurse
  const order = ['waiting', 'assigned', 'accepted', 'arrived', 'in_progress', 'completed']
  const at = order.indexOf(b.status)
  const steps = [
    { icon: 'assignment_ind', title: b.status === 'waiting' ? 'Finding your nurse' : 'Nurse Assigned & Kit Prepped', time: b.assigned_at,
      sub: n ? `${n.name}${n.qualification ? ' • ' + n.qualification : ''} • sealed sterile kit packed` : 'We are matching the nearest available nurse', done: at >= 2, active: at <= 1 },
    { icon: 'moped', title: n ? `Nurse ${firstName(n.name)} On the Bike` : 'Nurse on the bike', time: b.accepted_at,
      sub: b.status === 'accepted' ? `${km != null ? km + ' km away • ' : ''}Arriving in ~${etaMin ?? 20} mins` : b.mode === 'scheduled' && at < 2 ? `Leaves in time for ${timeLabel(b.scheduled_at)}` : 'Heads out as soon as the visit is accepted', done: at >= 3, active: at === 2 },
    { icon: 'door_front', title: 'Doorstep Arrival & ID Check', time: b.arrived_at,
      sub: b.needs_rx ? 'Razano ID shown • 5-point prescription check' : 'Razano ID shown • sterile kit opened in front of you', done: at >= 4, active: at === 3 },
    { icon: 'assignment_turned_in', title: 'Procedure & Vitals Report', time: b.completed_at,
      sub: b.status === 'completed' ? 'Report ready in Records' : 'Vitals and notes appear in Records', done: at >= 5, active: at === 4 },
  ]
  if (b.status === 'cancelled') return null
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <span className="font-headline-sm text-headline-sm text-on-surface">Dispatch Progress</span>
        <span className="font-label-sm text-label-sm text-secondary uppercase bg-verified-emerald-light px-2 py-0.5 rounded-full font-bold">Live Status</span>
      </div>
      <div className="flex flex-col relative">
        <div className="absolute left-4 top-4 bottom-5 w-0.5 bg-surface-container-high" />
        {steps.map((s, i) => (
          <div key={i} className={`flex items-start gap-3 relative z-10 ${i < steps.length - 1 ? 'pb-4' : ''} ${!s.done && !s.active ? (i === 3 ? 'opacity-40' : 'opacity-50') : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-secondary text-on-secondary shadow-sm' : s.active ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-outline'}`}>
              <Icon name={s.done ? 'check' : s.icon} className={`text-[16px] ${s.active ? 'animate-pulse' : ''} ${s.done ? 'font-bold' : ''}`} />
            </div>
            <div className="flex flex-col min-w-0 pt-0.5 flex-1">
              <div className="flex items-center justify-between w-full gap-2">
                <span className={`font-label-lg text-label-lg ${s.active ? 'text-primary' : 'text-on-surface'}`}>{s.title}</span>
                {s.time && <span className={`font-body-sm text-body-sm flex-shrink-0 ${s.active ? 'text-primary font-bold' : 'text-outline'}`}>{timeLabel(s.time)}</span>}
              </div>
              <span className={`font-body-sm text-body-sm ${s.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RxCard({ b, onUpdated }: { b: Booking; onUpdated: (b: Booking) => void }) {
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const has = !!b.rx?.has_image
  const upload = async (f: File) => {
    setBusy(true)
    try { const img = await compressImage(f); onUpdated(await rpc<Booking>('rr_rx_upload', { p_id: b.id, p_image: img })); toast.success('Prescription uploaded') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const nurseName = b.nurse ? `Nurse ${firstName(b.nurse.name)}` : 'your nurse'
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
          <Icon name="receipt_long" className="text-[22px]" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Speed Up Procedure Check</span>
            <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded-full font-bold ${b.needs_rx ? 'text-on-primary-fixed bg-primary-fixed' : 'text-tertiary bg-amber-warning-light'}`}>{b.needs_rx ? 'Needed' : 'Optional'}</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Upload the doctor's prescription so {nurseName} can review the medicine and dose before the doorbell rings.
          </p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <button type="button" onClick={() => input.current?.click()}
        className={`w-full p-3 rounded-lg flex items-center justify-between gap-2 active:scale-[0.99] transition-transform ${has ? 'bg-verified-emerald-light' : 'bg-surface-container-low'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={has ? 'task' : 'add_a_photo'} className={`text-[20px] ${has ? 'text-secondary' : 'text-primary'}`} />
          <span className="font-label-md text-label-md text-on-surface truncate">
            {busy ? 'Uploading…' : has ? (b.rx?.status === 'clear' || b.rx?.status === 'doctor_ok' ? 'Prescription checked ✓' : 'Prescription uploaded ✓') : 'Take photo of prescription'}
          </span>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">{has ? 'Replace' : 'Upload'}</span>
      </button>
      {GP_NAME && (
        <div className="flex items-center gap-2 pt-1">
          <Icon name="stethoscope" className="text-[18px] text-primary" />
          <span className="font-body-sm text-body-sm text-outline truncate">Unclear prescriptions reviewed by <strong className="text-on-surface">{GP_NAME}</strong></span>
        </div>
      )}
    </div>
  )
}

const REASONS = ['Booked by mistake', 'Need a different time', 'Patient not available', 'Taking too long', 'Other']

function CancelSheet({ open, onClose, b, onDone }: { open: boolean; onClose: () => void; b: Booking; onDone: (b: Booking) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { onDone(await rpc<Booking>('rr_cancel', { p_id: b.id, p_reason: reason })); toast('Visit cancelled'); onClose() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Cancel this visit?"
      footer={<PrimaryButton tone="danger" busy={busy} onClick={go}>Yes, cancel visit</PrimaryButton>}>
      <div className="flex flex-col gap-2">
        {b.status === 'accepted' && <p className="font-body-sm text-body-sm text-on-surface-variant">Your nurse is already on the way. If you can, please call them too.</p>}
        {REASONS.map(r => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={`rounded-lg p-3 text-left font-label-lg text-label-lg border ${reason === r ? 'border-2 border-primary-container bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-surface-container-lowest'}`}>{r}</button>
        ))}
      </div>
    </Sheet>
  )
}
