import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { TabPage, useUI } from '../components/AppShell'
import { Icon, PrimaryButton, Sheet, Spinner } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll } from '../lib/useInterval'
import { AREA_LABEL, SERVICE_SECTORS } from '../lib/config'
import { FALLBACK_SERVICES, HERO_IMG } from '../lib/services'
import type { Availability, Booking, Service } from '../lib/types'
import { addressLine, dayLabel, istDayKey, rupees, slotLabel } from '../lib/format'

const CART_KEY = 'rr_cart'

export default function Book() {
  const nav = useNavigate()
  const { user, patients, addresses, patientId, addressId, requireAuth, refreshActive } = useSession()
  const { openPicker } = useUI()
  const [services, setServices] = useState<Service[]>(FALLBACK_SERVICES)
  const [selected, setSelected] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]') } catch { return [] } })
  const [mode, setMode] = useState<'now' | 'scheduled'>('now')
  const [slot, setSlot] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [av, setAv] = useState<Availability | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [heroSrc, setHeroSrc] = useState('/hero.jpg')

  const patient = patients.find(p => p.id === patientId) || null
  const address = addresses.find(a => a.id === addressId) || null
  const inArea = !!address?.sector && SERVICE_SECTORS.includes(address.sector)

  useEffect(() => { rpc<{ services: Service[] }>('rr_services', {}, false).then(r => r.services?.length && setServices(r.services)).catch(() => {}) }, [])
  useEffect(() => { try { sessionStorage.setItem(CART_KEY, JSON.stringify(selected)) } catch { /* ignore */ } }, [selected])

  const loadAv = () => {
    rpc<Availability>('rr_availability', { p_sector: address?.sector ?? 50, p_lat: address?.lat ?? null, p_lng: address?.lng ?? null }, false)
      .then(setAv).catch(() => {})
  }
  usePoll(loadAv, 20000)
  useEffect(loadAv, [address?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = services.filter(s => selected.includes(s.code))
  const total = chosen.reduce((a, s) => a + s.price, 0)
  const toggle = (code: string) => setSelected(sel => sel.includes(code) ? sel.filter(c => c !== code) : [...sel, code])

  const days = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of av?.slots || []) { const k = istDayKey(new Date(s)); m.set(k, [...(m.get(k) || []), s]) }
    return [...m.entries()]
  }, [av])
  const activeDay = day && days.find(d => d[0] === day) ? day : days[0]?.[0] ?? null
  useEffect(() => { if (slot && av && !av.slots.includes(slot)) setSlot(null) }, [av, slot])

  const proceed = async () => {
    if (!selected.length) return toast.error('Select at least one procedure')
    try { await requireAuth() } catch { return }
    if (!patientId) return openPicker('patient')
    if (!addressId) return openPicker('address')
    if (!inArea) { toast.error(`We currently serve ${AREA_LABEL} only`); return openPicker('address') }
    if (address?.lat == null) { toast.error('Please pin the exact location on the map'); return openPicker('address') }
    if (mode === 'now' && av && !av.now_ok) {
      setMode('scheduled'); toast('All nurses are busy right now — please pick a time slot'); return
    }
    if (mode === 'scheduled' && !slot) return toast.error('Pick a time slot')
    setConfirmOpen(true)
  }

  const helper = (() => {
    if (mode === 'scheduled') {
      return slot
        ? { ok: true, icon: 'event_available', text: `Slot reserved: ${dayLabel(slot)} ${slotLabel(slot)}`, tag: 'Booked slot' }
        : { ok: false, icon: 'calendar_month', text: 'Pick a 30-minute slot below', tag: '' }
    }
    if (!av) return { ok: true, icon: 'radar', text: 'Checking nurses near you…', tag: '' }
    if (av.now_ok && av.nurse) {
      const who = `${av.nurse.qualification ? 'Nurse' : 'Nurse'} ${av.nurse.first_name}${av.nurse.qualification ? ` (${av.nurse.qualification})` : ''}`
      return { ok: true, icon: 'verified_user', text: av.nurse.km != null ? `${who} is ${av.nurse.km} km away` : `${who} is on duty near you`, tag: 'Ready' }
    }
    if (av.on_duty > 0) return { ok: false, icon: 'schedule', text: 'All nurses are on visits right now — schedule a slot', tag: 'Busy' }
    return { ok: false, icon: 'schedule', text: 'No nurse on duty right now — schedule a slot', tag: 'Schedule' }
  })()

  return (
    <TabPage>
      {/* Top Rapid Dispatch Notice & Coverage Area Banner */}
      <div className="px-margin-mobile pt-2 pb-1">
        <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl p-3.5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container">
              <Icon name="bolt" className="text-[16px]" />
            </span>
            <span className="font-headline-sm text-headline-sm tracking-tight text-white">Nurse at your door in 20 mins</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-primary-container">Sealed sterile kit • Registered GNM / B.Sc nurses • Starting ₹199</p>
          <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/95">
              <Icon name="radar" className="text-[15px] text-secondary-fixed" />
              <span className="font-label-md text-label-md tracking-tight">{AREA_LABEL}</span>
            </div>
            <span className="font-label-sm text-label-sm uppercase bg-white/20 text-white px-2 py-0.5 rounded-full font-bold tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* Recipient Profile Selector */}
      <div className="px-margin-mobile py-2.5">
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0 text-primary">
              <Icon name="elderly" className="text-[22px]" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-label-sm text-label-sm uppercase bg-primary-fixed text-on-primary-fixed px-1.5 py-0.5 rounded font-bold flex-shrink-0">Booking For</span>
                <span className="font-label-lg text-label-lg text-on-surface truncate">
                  {patient ? `${patient.relation && patient.relation !== 'Self' ? patient.relation + ' ' : ''}(${patient.name}, ${patient.age})` : user ? 'Add patient details' : 'Your parent / loved one'}
                </span>
              </div>
              <p className={`font-body-sm text-body-sm truncate ${address && !inArea ? 'text-error' : 'text-on-surface-variant'}`}>
                {address ? (inArea ? addressLine(address) : `Outside ${AREA_LABEL}`) : 'Add visit address'}
              </p>
            </div>
          </div>
          <button onClick={() => openPicker(patient ? 'address' : 'patient')} type="button"
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-primary font-label-md text-label-md hover:bg-surface-container active:scale-95 transition-all flex-shrink-0">
            {patient && address ? 'Change' : 'Add'}
          </button>
        </div>
      </div>

      {/* Dual Mode Urgent Booking Card */}
      <div className="px-margin-mobile py-2">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vital-red opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-vital-red" />
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Immediate Care Dispatch</span>
            </div>
            {mode === 'now' && av?.now_ok && av.eta_min != null && (
              <span className="font-label-sm text-label-sm bg-amber-warning-light text-tertiary px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                <Icon name="alarm" className="text-[13px]" /> {av.eta_min}m ETA
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-lg">
            {(['now', 'scheduled'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`py-2.5 px-3 rounded font-label-md text-label-md transition-all flex items-center justify-center gap-1.5 ${mode === m ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <Icon name={m === 'now' ? 'electric_bolt' : 'calendar_month'} className="text-[18px]" />
                <span>{m === 'now' ? 'Send Nearest Nurse Now' : 'Schedule for Parent'}</span>
              </button>
            ))}
          </div>
          <div className={`p-2.5 rounded-lg flex items-center justify-between gap-2 ${helper.ok ? 'bg-verified-emerald-light' : 'bg-amber-warning-light'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon name={helper.icon} className={`text-[18px] flex-shrink-0 ${helper.ok ? 'text-secondary' : 'text-tertiary-container'}`} />
              <span className={`font-body-sm text-body-sm font-bold ${helper.ok ? 'text-secondary' : 'text-tertiary-container'}`}>{helper.text}</span>
            </div>
            {helper.tag && <span className={`font-label-md text-label-md uppercase tracking-tight font-extrabold flex-shrink-0 ${helper.ok ? 'text-secondary' : 'text-tertiary-container'}`}>{helper.tag}</span>}
          </div>
          {mode === 'scheduled' && (
            <div className="flex flex-col gap-2">
              {!av ? <div className="flex justify-center py-3 text-primary"><Spinner /></div> : days.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">No free slots in the next 2 days. Please WhatsApp us.</p>
              ) : (
                <>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {days.map(([k, list]) => (
                      <button key={k} type="button" onClick={() => setDay(k)}
                        className={`px-3 h-9 rounded-full font-label-md text-label-md border flex-shrink-0 ${activeDay === k ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface-container-lowest border-[#E2E8F0] text-on-surface'}`}>
                        {dayLabel(list[0]!)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
                    {(days.find(d => d[0] === activeDay)?.[1] || []).map(s => (
                      <button key={s} type="button" onClick={() => setSlot(s)}
                        className={`h-10 rounded-lg font-label-md text-label-md border ${slot === s ? 'border-2 border-primary-container bg-[#F0F7FF] text-primary-container' : 'border-[#E2E8F0] bg-surface-container-lowest text-on-surface'}`}>
                        {slotLabel(s).split(' – ')[0]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Medical Safety & Authority Pillars */}
      <div className="px-margin-mobile py-2">
        <div className="bg-surface-container-high rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-primary">
            <Icon name="shield" className="text-[18px]" />
            <span className="font-label-lg text-label-lg uppercase tracking-wider">Razano Clinical Safety Protocol</span>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1">
            <Pillar icon="verified" color="text-secondary" title="Registered nurses only:"
              text="GNM / B.Sc nurses with nursing council registration, police verification & a practical skills test." />
            <Pillar icon="medical_services" color="text-primary" title="Zero-drug-sales policy:"
              text="We bring sealed single-use sterile supplies; your family provides the prescribed medicine." />
            <Pillar icon="support_agent" color="text-tertiary-container" title="Prescription check:"
              text="Before every injection the nurse runs a 5-point prescription check; anything unclear goes to a doctor first." />
          </div>
        </div>
      </div>

      {/* Visual Clinical Glimpse Strip */}
      <div className="px-margin-mobile py-2">
        <div className="relative rounded-xl overflow-hidden shadow-sm h-32 bg-surface-container">
          <img className="w-full h-full object-cover" alt="" src={heroSrc} onError={() => heroSrc !== HERO_IMG && setHeroSrc(HERO_IMG)} />
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/30 to-transparent flex flex-col justify-end p-3">
            <span className="font-headline-sm text-headline-sm text-white font-bold">Compassionate Senior Bedside Care</span>
            <span className="font-body-sm text-body-sm text-white/90">Hospital-grade hygiene at home, with live tracking for family</span>
          </div>
        </div>
      </div>

      {/* Services Catalog */}
      <div className="px-margin-mobile pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Select Nursing Procedure</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Tap to add one or multiple procedures</p>
        </div>
        <span className="font-label-sm text-label-sm uppercase bg-surface-container-high px-2 py-1 rounded text-primary font-bold flex-shrink-0">{services.length} Available</span>
      </div>
      <div className="px-margin-mobile py-2 flex flex-col gap-2.5">
        {services.map(s => {
          const on = selected.includes(s.code)
          return (
            <div key={s.code} role="button" tabIndex={0} onClick={() => toggle(s.code)} onKeyDown={e => e.key === 'Enter' && toggle(s.code)}
              className={`p-3.5 rounded-xl shadow-sm flex items-center justify-between gap-3 active:scale-[0.99] transition-transform cursor-pointer ${on ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}>
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-primary'}`}>
                  <Icon name={s.icon} className="text-[24px]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-headline-sm text-headline-sm text-on-surface ${on ? 'font-bold' : ''}`}>{s.name}</span>
                    {s.popular && <span className="font-label-sm text-label-sm bg-verified-emerald-light text-secondary px-1.5 py-0.5 rounded font-extrabold uppercase">Most Popular</span>}
                    {s.needs_rx && <span className="font-label-sm text-label-sm bg-primary-fixed text-on-primary-fixed px-1.5 py-0.5 rounded font-extrabold uppercase">Prescription Needed</span>}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">{s.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-headline-sm text-headline-sm text-primary font-bold">{rupees(s.price)}</span>
                    <span className="font-body-sm text-body-sm text-outline flex items-center gap-0.5">
                      <Icon name="schedule" className="text-[14px]" /> {s.minutes} mins
                    </span>
                  </div>
                </div>
              </div>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'}`}>
                <Icon name={on ? 'check' : 'add'} className="text-[20px]" />
              </span>
            </div>
          )
        })}
      </div>

      {/* Instant UPI strip */}
      <div className="px-margin-mobile py-2.5">
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="verified" className="text-[20px] text-secondary" />
            <span className="font-body-sm text-body-sm text-on-surface">Pay after the visit via</span>
          </div>
          <div className="flex items-center gap-1.5">
            {['GPay', 'PhonePe', 'Paytm'].map(x => <span key={x} className="font-label-sm text-label-sm font-extrabold px-2 py-0.5 bg-surface-container-lowest rounded-full text-on-surface">{x}</span>)}
          </div>
        </div>
      </div>

      <div className="px-margin-mobile pt-1 pb-24 flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-2 text-outline">
          <Icon name="lock" className="text-[16px]" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider">Registered nurses • Police verified • ISO 9001</span>
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Razano Rapid by Sevora Care Pvt Ltd • {AREA_LABEL}</span>
        <div className="flex gap-3 mt-1"><a href="/privacy" className="font-label-sm text-label-sm text-outline underline">Terms & Privacy</a><a href="/nurse" className="font-label-sm text-label-sm text-outline underline">Razano nurse? Log in</a></div>
      </div>

      {/* Floating Bottom Dispatch CTA Bar */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-margin-mobile py-2 bg-surface/90 backdrop-blur-md mb-[env(safe-area-inset-bottom)]">
        <div className="bg-surface-container-lowest rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 max-w-[528px] mx-auto">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-label-md text-label-md text-primary font-extrabold uppercase">{chosen.length === 1 ? '1 Service' : `${chosen.length} Services`}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">Standard Kit Incl.</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-md text-headline-md text-on-surface font-extrabold">{rupees(total)}</span>
              <span className="font-label-sm text-label-sm text-outline">all inclusive</span>
            </div>
          </div>
          <button onClick={proceed} type="button"
            className="h-12 px-5 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md flex-shrink-0 disabled:opacity-50"
            disabled={!chosen.length}>
            <span>Confirm Nurse</span>
            <Icon name="arrow_forward" className="text-[18px]" />
          </button>
        </div>
      </div>

      <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} services={chosen} total={total} mode={mode} slot={slot}
        eta={av?.eta_min ?? 20}
        onBooked={b => {
          setConfirmOpen(false); setSelected([]); setSlot(null); refreshActive()
          nav(`/track/${b.id}${b.pay_method === 'now' ? '?pay=1' : ''}`)
        }} />
    </TabPage>
  )
}

function Pillar({ icon, color, title, text }: { icon: string; color: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2 bg-surface-container-lowest p-2 rounded-lg">
      <Icon name={icon} className={`text-[18px] ${color} flex-shrink-0 mt-0.5`} />
      <p className="font-body-sm text-body-sm text-on-surface">
        <strong className="font-label-md text-label-md text-on-surface">{title}</strong> {text}
      </p>
    </div>
  )
}

function ConfirmSheet({ open, onClose, services, total, mode, slot, eta, onBooked }: {
  open: boolean; onClose: () => void; services: Service[]; total: number; mode: 'now' | 'scheduled'; slot: string | null; eta: number
  onBooked: (b: Booking) => void
}) {
  const { patients, addresses, patientId, addressId } = useSession()
  const { openPicker } = useUI()
  const [pay, setPay] = useState<'after' | 'now'>('after')
  const [busy, setBusy] = useState(false)
  const patient = patients.find(p => p.id === patientId)
  const address = addresses.find(a => a.id === addressId)
  const needsRx = services.some(s => s.needs_rx)

  const book = async () => {
    setBusy(true)
    try {
      const b = await rpc<Booking>('rr_book', { p: { patient_id: patientId, address_id: addressId, services: services.map(s => s.code), mode, scheduled_at: slot, pay_method: pay } })
      toast.success(b.status === 'waiting' ? 'Booked! We are finding your nurse.' : 'Nurse booked!')
      onBooked(b)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Confirm your visit"
      footer={<PrimaryButton busy={busy} onClick={book}><Icon name="check_circle" className="text-[20px]" /><span>Book Nurse • {rupees(total)}</span></PrimaryButton>}>
      <div className="flex flex-col gap-3">
        <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col gap-2">
          <Line icon="elderly" label="Patient" value={patient ? `${patient.name} (${patient.age}${patient.gender ? ' ' + patient.gender : ''})` : '-'} onEdit={() => { onClose(); openPicker('patient') }} />
          <Line icon="location_on" label="Address" value={address ? addressLine(address) : '-'} onEdit={() => { onClose(); openPicker('address') }} />
          <Line icon={mode === 'now' ? 'electric_bolt' : 'calendar_month'} label="When"
            value={mode === 'now' ? `Now — nurse reaches in about ${eta} mins` : slot ? `${dayLabel(slot)}, ${slotLabel(slot)}` : '-'} />
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col gap-1.5">
          {services.map(s => (
            <div key={s.code} className="flex justify-between font-body-sm text-body-sm text-on-surface"><span>{s.name}</span><span className="font-label-lg text-label-lg">{rupees(s.price)}</span></div>
          ))}
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface-variant"><span>Sterile consumables kit</span><span className="text-secondary font-label-md text-label-md">INCLUDED</span></div>
          <div className="h-px bg-surface-container my-1" />
          <div className="flex justify-between items-center"><span className="font-headline-sm text-headline-sm">Total</span><span className="font-headline-md text-headline-md text-primary">{rupees(total)}</span></div>
        </div>
        {needsRx && (
          <div className="rounded-lg bg-amber-warning-light p-3 flex gap-2">
            <Icon name="receipt_long" className="text-[20px] text-tertiary-container flex-shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface">
              <strong className="font-label-md text-label-md">Keep the doctor's prescription and the medicine ready.</strong> We don't carry medicines. The nurse checks the prescription before giving any injection.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="font-label-md text-label-md text-outline uppercase tracking-wider">Payment</div>
          {([['after', 'Pay after the visit', 'UPI or cash to the nurse'], ['now', 'Pay now by UPI', 'GPay / PhonePe / Paytm']] as const).map(([v, t, sub]) => (
            <button key={v} type="button" onClick={() => setPay(v)}
              className={`rounded-lg p-3 flex items-center gap-3 text-left border ${pay === v ? 'border-2 border-primary-container bg-[#F0F7FF]' : 'border-[#E2E8F0] bg-surface-container-lowest'}`}>
              <Icon name={pay === v ? 'radio_button_checked' : 'radio_button_unchecked'} className={`text-[22px] ${pay === v ? 'text-primary-container' : 'text-outline'}`} />
              <div><div className="font-label-lg text-label-lg text-on-surface">{t}</div><div className="font-body-sm text-body-sm text-on-surface-variant">{sub}</div></div>
            </button>
          ))}
        </div>
        <p className="font-body-sm text-body-sm text-outline">Medical emergency? Don't book — call 112 now.</p>
      </div>
    </Sheet>
  )
}

function Line({ icon, label, value, onEdit }: { icon: string; label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} className="text-[20px] text-primary mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-label-sm text-label-sm text-outline uppercase">{label}</div>
        <div className="font-body-md text-body-md text-on-surface">{value}</div>
      </div>
      {onEdit && <button type="button" onClick={onEdit} className="font-label-md text-label-md text-primary px-2 py-1">Change</button>}
    </div>
  )
}
