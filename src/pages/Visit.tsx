import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { BackHeader } from '../components/AppShell'
import { UpiPayCard } from '../components/UpiPay'
import { Avatar, Icon, Spinner } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { RAZANO_WHATSAPP } from '../lib/config'
import { addressLine, dateTimeLabel, firstName, patientLine, rupees, telLink, waLink } from '../lib/format'
import type { Booking, Vitals } from '../lib/types'

export default function Visit() {
  const { id } = useParams()
  const { user } = useSession()
  const [b, setB] = useState<Booking | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    if (!user || !id) return
    rpc<Booking>('rr_booking', { p_id: id }).then(setB).catch(e => setErr(e.message))
  }, [id, user])
  useEffect(load, [load])

  return (
    <>
      <BackHeader title={b?.status === 'completed' ? 'Visit Report' : 'Visit Details'} />
      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface max-w-[560px] mx-auto min-h-screen">
        {!b ? (
          <div className="flex justify-center pt-16 text-primary">{err ? <p className="font-body-md text-body-md text-on-surface-variant px-6 text-center">{err}</p> : <Spinner className="text-[32px]" />}</div>
        ) : <VisitBody b={b} setB={setB} />}
      </main>
    </>
  )
}

function bpNote(v: Vitals) {
  if (v.bp_sys == null || v.bp_dia == null) return null
  if (v.bp_sys >= 180 || v.bp_dia >= 110) return { ok: false, text: 'Very high — call your doctor' }
  if (v.bp_sys >= 140 || v.bp_dia >= 90) return { ok: false, text: 'Above normal — share with doctor' }
  if (v.bp_sys < 90 || v.bp_dia < 60) return { ok: false, text: 'Low — share with doctor' }
  return { ok: true, text: 'Within normal range' }
}
function spo2Note(x?: number) {
  if (x == null) return null
  if (x < 90) return { ok: false, text: 'Low — seek care now' }
  if (x < 95) return { ok: false, text: 'Below normal' }
  return { ok: true, text: 'Normal saturation' }
}
function pulseNote(x?: number) {
  if (x == null) return null
  return x >= 60 && x <= 100 ? { ok: true, text: 'Within normal range' } : { ok: false, text: 'Outside normal range' }
}

function VisitBody({ b, setB }: { b: Booking; setB: (b: Booking) => void }) {
  const v = b.vitals || {}
  const n = b.nurse
  const done = b.status === 'completed'
  const hasVitals = Object.keys(v).length > 0

  const summary = () => {
    const lines = [
      `*Razano Rapid visit report — ${b.ref}*`,
      `Patient: ${patientLine(b.patient)}`,
      `Date: ${dateTimeLabel(b.completed_at || b.scheduled_at)}`,
      n ? `Nurse: ${n.name}${n.qualification ? ' (' + n.qualification + ')' : ''}${n.reg_no ? ', Reg ' + n.reg_no : ''}` : '',
      v.bp_sys != null ? `BP: ${v.bp_sys}/${v.bp_dia} mmHg` : '',
      v.sugar != null ? `Blood sugar: ${v.sugar} mg/dL${v.sugar_context ? ' (' + v.sugar_context + ')' : ''}` : '',
      v.pulse != null ? `Pulse: ${v.pulse} bpm` : '',
      v.spo2 != null ? `SpO2: ${v.spo2}%` : '',
      v.temp != null ? `Temp: ${v.temp} °F` : '',
      b.procedure_note ? `Procedure: ${b.procedure_note}` : '',
      b.nurse_notes ? `Nurse notes: ${b.nurse_notes}` : '',
    ].filter(Boolean)
    return lines.join('\n')
  }

  return (
    <div className="px-margin-mobile py-space-md space-y-space-md">
      {/* Status hero */}
      {done ? (
        <div className="bg-verified-emerald-light rounded-xl p-space-md shadow-sm flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon name="check_circle" fill className="text-[28px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-secondary truncate">Visit Completed</span>
              <span className="bg-secondary text-on-secondary font-label-sm text-label-sm px-2 py-0.5 rounded-full">RAPID</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">Logged by {n ? n.name : 'your nurse'} • {dateTimeLabel(b.completed_at)}</p>
          </div>
        </div>
      ) : (
        <div className={`${b.status === 'cancelled' ? 'bg-error-container' : 'bg-primary-fixed'} rounded-xl p-space-md shadow-sm flex items-center gap-space-md`}>
          <Icon name={b.status === 'cancelled' ? 'cancel' : 'schedule'} className="text-[28px]" />
          <div>
            <div className="font-headline-sm text-headline-sm">{b.status === 'cancelled' ? 'Visit Cancelled' : 'Visit in progress'}</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{b.status === 'cancelled' ? b.cancel_reason || '' : dateTimeLabel(b.scheduled_at)}</p>
          </div>
        </div>
      )}

      {/* Patient & nurse */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="space-y-space-xs min-w-0">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Patient Details</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{patientLine(b.patient)}</h2>
            <div className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm">
              <Icon name="location_on" className="text-[16px] text-primary" />
              <span className="truncate">{addressLine(b.address)}</span>
            </div>
          </div>
          <span className="bg-surface-container text-primary font-label-sm text-label-sm px-2.5 py-1 rounded-full whitespace-nowrap">ID: #{b.ref}</span>
        </div>
        {n && (<>
          <div className="h-px bg-surface-container" />
          <div className="flex items-center gap-space-md">
            <div className="relative flex-shrink-0">
              <Avatar name={n.name} photo={n.photo} className="w-13 h-13" textClass="text-label-lg" />
              {n.verified && <span className="absolute bottom-0 right-0 w-4 h-4 bg-secondary text-on-secondary rounded-full flex items-center justify-center"><Icon name="verified" className="text-[12px]" /></span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-space-xs">
                <h3 className="font-label-lg text-label-lg text-on-surface truncate">{n.name}</h3>
                {n.reg_no && <span className="bg-verified-emerald-light text-secondary font-label-sm text-label-sm px-1.5 py-0.5 rounded flex-shrink-0">Reg {n.reg_no}</span>}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{n.qualification ? `${n.qualification} • ` : ''}Razano Rapid nurse</p>
            </div>
            <a aria-label="Call nurse" href={telLink(n.phone)} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary active:scale-95 transition-transform no-print">
              <Icon name="phone_in_talk" className="text-[20px]" />
            </a>
          </div>
        </>)}
      </div>

      {/* Vitals */}
      {(done || hasVitals) && (
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <Icon name="vital_signs" className="text-primary text-[22px]" />
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Recorded Clinical Vitals</h3>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-verified-emerald-light px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Nurse logged
            </span>
          </div>
          {hasVitals ? (
            <div className="grid grid-cols-2 gap-space-sm">
              {v.bp_sys != null && <VitalTile label="BLOOD PRESSURE" icon="favorite" iconCls="text-secondary" value={`${v.bp_sys}/${v.bp_dia}`} note={bpNote(v)} />}
              {v.sugar != null && <VitalTile label="BLOOD SUGAR" icon="water_drop" iconCls="text-tertiary" value={String(v.sugar)} unit="mg/dL"
                note={v.sugar_context ? { ok: true, text: v.sugar_context, neutral: true, icon: 'history' } : null} />}
              {v.pulse != null && <VitalTile label="PULSE RATE" icon="monitor_heart" iconCls="text-primary" value={String(v.pulse)} unit="bpm" note={pulseNote(v.pulse)} />}
              {v.spo2 != null && <VitalTile label="BLOOD OXYGEN (SPO2)" icon="air" iconCls="text-electric-cerulean" value={`${v.spo2}%`} note={spo2Note(v.spo2)} />}
              {v.temp != null && <VitalTile label="TEMPERATURE" icon="thermometer" iconCls="text-tertiary" value={String(v.temp)} unit="°F" note={null} />}
            </div>
          ) : <p className="font-body-sm text-body-sm text-on-surface-variant">No vitals were recorded for this visit.</p>}
          <div className="space-y-space-sm pt-space-xs">
            {b.procedure_note && (
              <div className="bg-surface-container-low rounded-lg p-space-sm space-y-1">
                <div className="font-label-sm text-label-sm text-outline uppercase">Procedure Done</div>
                <div className="font-label-lg text-label-lg text-on-surface flex items-start gap-1.5">
                  <Icon name={b.services[0]?.icon || 'vaccines'} className="text-primary text-[18px] flex-shrink-0 mt-0.5" />
                  <span>{b.procedure_note}</span>
                </div>
              </div>
            )}
            {b.injection_skipped && (
              <div className="bg-amber-warning-light rounded-lg p-space-sm font-body-sm text-body-sm text-on-surface">
                <strong className="font-label-md text-label-md">Injection not given:</strong> the prescription could not be verified at the visit. Please check with your doctor and rebook.
              </div>
            )}
            {b.consumables && (
              <div className="bg-surface-container-low rounded-lg p-space-sm space-y-1">
                <div className="font-label-sm text-label-sm text-outline uppercase">Sterile Consumables Used</div>
                <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
                  <Icon name="clean_hands" className="text-secondary text-[16px]" /><span>{b.consumables}</span>
                </p>
              </div>
            )}
            {b.nurse_notes && (
              <div className="bg-amber-warning-light rounded-lg p-space-sm space-y-1">
                <div className="font-label-sm text-label-sm text-tertiary uppercase flex items-center gap-1"><Icon name="edit_note" className="text-[14px]" /> Nurse Bedside Notes</div>
                <p className="font-body-sm text-body-sm text-on-surface italic">“{b.nurse_notes}”</p>
              </div>
            )}
          </div>
          {done && (
            <div className="pt-space-xs no-print">
              <a href={`https://wa.me/?text=${encodeURIComponent(summary())}`} target="_blank" rel="noreferrer"
                className="w-full h-11 bg-verified-emerald-light text-secondary rounded-lg flex items-center justify-center gap-2 font-label-lg text-label-lg active:scale-[0.98] transition-transform">
                <Icon name="share" className="text-[20px]" /><span>Send Summary to Doctor on WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      )}

      {done && n && <RateCard b={b} setB={setB} />}

      {/* Billing */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <Icon name="receipt_long" className="text-primary text-[22px]" />
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Payment & Billing</h3>
          </div>
          <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${b.pay_status === 'paid' ? 'bg-verified-emerald-light text-secondary' : 'bg-amber-warning-light text-tertiary-container'}`}>
            {b.pay_status === 'paid' ? 'PAID' : b.pay_status === 'claimed' ? 'VERIFYING' : b.status === 'cancelled' ? 'NO CHARGE' : 'DUE'}
          </span>
        </div>
        <div className="space-y-space-sm text-body-sm font-body-sm">
          {b.services.map(s => (
            <div key={s.code} className="flex justify-between items-center text-on-surface gap-2"><span>{s.name}</span><span className="font-label-lg text-label-lg">{rupees(s.price)}</span></div>
          ))}
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="flex items-center gap-1"><span>Sterile Consumable Sealed Kit</span><Icon name="verified_user" className="text-[14px] text-secondary" /></span>
            <span className="text-secondary font-label-md text-label-md">INCLUDED (₹0)</span>
          </div>
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>{b.mode === 'now' ? 'Rapid 20-min dispatch' : 'Scheduled home visit'}</span>
            <span className="text-secondary font-label-md text-label-md">FREE (₹0)</span>
          </div>
          <div className="h-px bg-surface-container" />
          <div className="flex justify-between items-center text-on-surface pt-space-xs">
            <div>
              <span className="font-headline-sm text-headline-sm">Total Amount</span>
              <p className="font-label-sm text-label-sm text-outline">{b.pay_status === 'paid' ? `Paid${b.paid_via ? ' via ' + b.paid_via.toUpperCase() : ''}` : 'Pay by UPI or cash to the nurse'}</p>
            </div>
            <span className="font-headline-md text-headline-md text-primary">{rupees(b.status === 'cancelled' ? 0 : b.total)}</span>
          </div>
        </div>
      </div>

      {b.status !== 'cancelled' && <div className="no-print"><UpiPayCard booking={b} onUpdated={setB} /></div>}

      <div className="space-y-space-sm pb-space-lg">
        {done && (
          <button onClick={() => window.print()} className="w-full h-12 bg-surface-container-lowest text-primary rounded-xl flex items-center justify-center gap-2 font-label-lg text-label-lg shadow-sm active:scale-[0.98] transition-transform no-print">
            <Icon name="description" className="text-[20px]" /><span>Download Clinical Report PDF</span>
          </button>
        )}
        <div className="text-center">
          <p className="font-label-sm text-label-sm text-outline">
            Razano Rapid by Sevora Care Pvt Ltd • Help: <a className="underline" href={waLink(RAZANO_WHATSAPP, `Hi, about visit ${b.ref}`)}>WhatsApp {RAZANO_WHATSAPP.slice(2, 7)} {RAZANO_WHATSAPP.slice(7)}</a> • Emergency: 112
          </p>
        </div>
      </div>
    </div>
  )
}

function VitalTile({ label, icon, iconCls, value, unit, note }: {
  label: string; icon: string; iconCls: string; value: string; unit?: string
  note: { ok: boolean; text: string; neutral?: boolean; icon?: string } | null
}) {
  return (
    <div className="bg-surface-container-low rounded-lg p-space-sm space-y-space-xs">
      <div className="flex items-center justify-between gap-1">
        <span className="font-label-sm text-label-sm text-outline">{label}</span>
        <Icon name={icon} className={`${iconCls} text-[16px]`} />
      </div>
      <div className="font-headline-md text-headline-md text-on-surface">{value}{unit && <span className="font-label-sm text-label-sm text-outline"> {unit}</span>}</div>
      {note && (
        <div className={`flex items-center gap-1 font-body-sm text-body-sm ${note.neutral ? 'text-on-surface-variant' : note.ok ? 'text-secondary' : 'text-error'}`}>
          <Icon name={note.icon || (note.ok ? 'check_circle' : 'error')} className="text-[14px]" />
          <span>{note.text}</span>
        </div>
      )}
    </div>
  )
}

const LABELS: Record<number, string> = { 1: '1.0 Needs Attention', 2: '2.0 Below Expectation', 3: '3.0 Good Standard', 4: '4.0 Very Courteous', 5: '5.0 Excellent' }
const TAGS = ['Glove hygiene followed', 'Gentle with senior', 'On time', 'Explained clearly', 'Clean & tidy']

function RateCard({ b, setB }: { b: Booking; setB: (b: Booking) => void }) {
  const [stars, setStars] = useState(b.rating || 0)
  const [tags, setTags] = useState<string[]>(b.rating_tags || [])
  const [busy, setBusy] = useState(false)
  const rated = !!b.rating
  const save = async () => {
    if (!stars) return toast.error('Tap the stars to rate')
    setBusy(true)
    try { setB(await rpc<Booking>('rr_rate', { p_id: b.id, p_rating: stars, p_tags: tags, p_comment: '' })); toast.success('Thank you for the feedback!') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm no-print">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{rated ? 'Your rating' : `Rate Nurse ${firstName(b.nurse?.name)}`}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Helps us keep clinical standards high</p>
        </div>
        {stars > 0 && <span className="text-secondary font-label-lg text-label-lg">{LABELS[stars]}</span>}
      </div>
      <div className="flex items-center gap-2 py-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} aria-label={`${i} stars`} disabled={rated} onClick={() => setStars(i)}
            className={`${i <= stars ? 'text-tertiary-fixed-dim' : 'text-outline-variant'} hover:scale-110 active:scale-95 transition-transform`}>
            <Icon name="star" fill={i <= stars} className="text-[32px]" />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {TAGS.map(t => {
          const on = tags.includes(t)
          return (
            <button key={t} disabled={rated} onClick={() => setTags(on ? tags.filter(x => x !== t) : [...tags, t])}
              className={`font-label-sm text-label-sm px-2.5 py-1 rounded-full transition-colors ${on ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>{t}</button>
          )
        })}
      </div>
      {!rated && stars > 0 && (
        <button onClick={save} disabled={busy} className="w-full h-11 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg active:scale-[0.98] disabled:opacity-60">
          {busy ? 'Saving…' : 'Submit rating'}
        </button>
      )}
    </div>
  )
}
