import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { AREA_LABEL, RAZANO_WHATSAPP, SERVICE_SECTORS } from '../lib/config'
import type { Address, Patient } from '../lib/types'
import { addressLine, patientLine, waLink } from '../lib/format'
import { Field, Icon, PrimaryButton, Sheet } from './ui'
import { MapPicker } from './MapPicker'
import { reversePlace, type Place } from '../lib/geo'

type View = { kind: 'list' } | { kind: 'patient'; p: Partial<Patient> } | { kind: 'address'; a: Partial<Address> }

export function PickerSheet({ open, onClose, focus }: { open: boolean; onClose: () => void; focus: 'patient' | 'address' }) {
  const { user, patients, addresses, patientId, addressId, setPatientId, setAddressId, requireAuth } = useSession()
  const [view, setView] = useState<View>({ kind: 'list' })

  useEffect(() => {
    if (!open) return
    if (user && focus === 'patient' && patients.length === 0) setView({ kind: 'patient', p: {} })
    else if (user && focus === 'address' && addresses.length === 0) setView({ kind: 'address', a: {} })
    else setView({ kind: 'list' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focus])

  const title = view.kind === 'patient' ? (view.p.id ? 'Edit patient' : 'Who is the visit for?')
    : view.kind === 'address' ? (view.a.id ? 'Edit address' : 'Visit address') : 'Booking for'

  return (
    <Sheet open={open} onClose={onClose} title={title} tall={view.kind === 'address'}>
      {!user ? (
        <div className="flex flex-col gap-3 pt-2">
          <p className="font-body-md text-body-md text-on-surface-variant">Log in once to save your parent's details and address. Next time booking takes one tap.</p>
          <PrimaryButton onClick={() => { requireAuth().catch(() => {}) }}>Log in / Sign up</PrimaryButton>
        </div>
      ) : view.kind === 'patient' ? (
        <PatientForm initial={view.p} onDone={id => { if (id) setPatientId(id); setView({ kind: 'list' }); if (addresses.length === 0 && id) setView({ kind: 'address', a: {} }) }} />
      ) : view.kind === 'address' ? (
        <AddressForm initial={view.a} onDone={id => { if (id) setAddressId(id); setView({ kind: 'list' }) }} />
      ) : (
        <div className="flex flex-col gap-4 pt-1">
          <section className="flex flex-col gap-2">
            <div className="font-label-md text-label-md text-outline uppercase tracking-wider">Patient</div>
            {patients.map(p => (
              <Row key={p.id} selected={p.id === patientId} icon="elderly"
                title={`${p.relation ? p.relation + ' · ' : ''}${patientLine(p)}`} sub={p.notes || 'No medical notes'}
                onSelect={() => setPatientId(p.id)} onEdit={() => setView({ kind: 'patient', p })} />
            ))}
            <AddRow label="Add a patient" onClick={() => setView({ kind: 'patient', p: {} })} />
          </section>
          <section className="flex flex-col gap-2">
            <div className="font-label-md text-label-md text-outline uppercase tracking-wider">Visit address</div>
            {addresses.map(a => (
              <Row key={a.id} selected={a.id === addressId} icon="home_pin"
                title={a.label || a.line2 || 'Address'} sub={addressLine(a)}
                warn={a.lat == null ? 'Map pin missing — tap edit to pin it' : !a.sector || !SERVICE_SECTORS.includes(a.sector) ? `Outside ${AREA_LABEL}` : undefined}
                onSelect={() => setAddressId(a.id)} onEdit={() => setView({ kind: 'address', a })} />
            ))}
            <AddRow label="Add an address" onClick={() => setView({ kind: 'address', a: {} })} />
          </section>
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      )}
    </Sheet>
  )
}

function Row({ selected, icon, title, sub, warn, onSelect, onEdit }: {
  selected: boolean; icon: string; title: string; sub: string; warn?: string; onSelect: () => void; onEdit: () => void
}) {
  return (
    <div className={`rounded-xl p-3 flex items-center gap-3 transition-colors ${selected ? 'bg-surface-container-low ring-2 ring-primary-container' : 'bg-surface-container-lowest shadow-sm'}`}>
      <button type="button" onClick={onSelect} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-primary'}`}>
          <Icon name={icon} className="text-[22px]" />
        </div>
        <div className="min-w-0">
          <div className="font-label-lg text-label-lg text-on-surface truncate">{title}</div>
          <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{sub}</div>
          {warn && <div className="font-label-sm text-label-sm text-error mt-0.5">{warn}</div>}
        </div>
      </button>
      <button type="button" aria-label="Edit" onClick={onEdit} className="w-9 h-9 rounded-full bg-surface-container text-primary flex items-center justify-center flex-shrink-0">
        <Icon name="edit" className="text-[18px]" />
      </button>
    </div>
  )
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl p-3 flex items-center gap-3 border-[1.5px] border-dashed border-outline-variant text-primary active:scale-[0.99]">
      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center"><Icon name="add" className="text-[22px]" /></div>
      <span className="font-label-lg text-label-lg">{label}</span>
    </button>
  )
}

const RELATIONS = ['Father', 'Mother', 'Self', 'Spouse', 'Grandparent', 'Other']

function PatientForm({ initial, onDone }: { initial: Partial<Patient>; onDone: (id?: string) => void }) {
  const { refresh } = useSession()
  const [f, setF] = useState({ name: initial.name || '', age: initial.age ? String(initial.age) : '', gender: initial.gender || '', relation: initial.relation || '', notes: initial.notes || '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await rpc<Patient>('rr_save_patient', { p: { ...f, id: initial.id } })
      await refresh(); toast.success('Patient saved'); onDone(r.id)
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!initial.id || !confirm('Remove this patient?')) return
    try { await rpc('rr_delete_patient', { p_id: initial.id }); await refresh(); onDone() } catch (err) { toast.error((err as Error).message) }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-wrap gap-1.5">
        {RELATIONS.map(r => (
          <button type="button" key={r} onClick={() => setF({ ...f, relation: r })}
            className={`px-3 h-9 rounded-full font-label-md text-label-md border ${f.relation === r ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface-container-lowest border-[#E2E8F0] text-on-surface'}`}>{r}</button>
        ))}
      </div>
      <Field label="Patient's full name"><input className="field" value={f.name} onChange={set('name')} placeholder="e.g. Devendra Sharma" required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age"><input className="field" value={f.age} onChange={set('age')} inputMode="numeric" placeholder="72" required /></Field>
        <Field label="Gender">
          <select className="field" value={f.gender} onChange={set('gender')}>
            <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Medical notes for the nurse (optional)">
        <textarea className="field" value={f.notes} onChange={set('notes')} placeholder="e.g. Diabetic, on insulin. Allergic to sulfa. Uses walker." />
      </Field>
      <PrimaryButton type="submit" busy={busy}>Save patient</PrimaryButton>
      {initial.id && <button type="button" onClick={del} className="font-label-md text-label-md text-error py-2">Remove patient</button>}
    </form>
  )
}

function AddressForm({ initial, onDone }: { initial: Partial<Address>; onDone: (id?: string) => void }) {
  const { refresh } = useSession()
  const [f, setF] = useState({
    label: initial.label || '', line1: initial.line1 || '', line2: initial.line2 || '',
    sector: initial.sector ? String(initial.sector) : '', landmark: initial.landmark || '',
  })
  const [pos, setPos] = useState<[number, number] | null>(initial.lat && initial.lng ? [initial.lat, initial.lng] : null)
  const [step, setStep] = useState<'pin' | 'details'>(initial.lat && initial.lng ? 'details' : 'pin')
  const [near, setNear] = useState<Place | null>(null)
  const [picked, setPicked] = useState<Place | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const outside = f.sector === '0'

  // show what's under the pin so the family knows it's right
  useEffect(() => {
    if (step !== 'pin' || !pos) return
    const ctl = new AbortController()
    const t = setTimeout(() => { reversePlace(pos[0], pos[1], ctl.signal).then(setNear).catch(() => {}) }, 700)
    return () => { clearTimeout(t); ctl.abort() }
  }, [pos?.[0], pos?.[1], step]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmPin = () => {
    if (!pos) return toast.error('Move the map to your door first')
    const src = picked || near
    const sec = picked?.sector ?? near?.sector ?? null
    setF(x => ({
      ...x,
      line2: x.line2 || (src ? [src.label, src.sub.split(',')[0]].filter((v, i, a) => v && a.indexOf(v) === i && !/^gurugram$/i.test(v)).join(', ') : ''),
      sector: x.sector || (sec && SERVICE_SECTORS.includes(sec) ? String(sec) : sec ? '0' : ''),
    }))
    setStep('details')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pos) { setStep('pin'); return toast.error('Pin your location on the map') }
    if (!f.sector) return toast.error('Choose your sector')
    setBusy(true)
    try {
      const r = await rpc<Address>('rr_save_address', { p: { ...f, sector: outside ? null : f.sector, id: initial.id, lat: pos[0], lng: pos[1] } })
      await refresh(); toast.success('Address saved'); onDone(r.id)
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!initial.id || !confirm('Remove this address?')) return
    try { await rpc('rr_delete_address', { p_id: initial.id }); await refresh(); onDone() } catch (err) { toast.error((err as Error).message) }
  }

  if (step === 'pin') {
    return (
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center gap-2 font-label-md text-label-md text-outline">
          <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center">1</span> Find your home
          <span className="flex-1 h-px bg-surface-container" />
          <span className="w-6 h-6 rounded-full bg-surface-container text-outline flex items-center justify-center">2</span> Flat details
        </div>
        <MapPicker value={pos} onChange={setPos} onPlace={p => { setPicked(p); setNear(p) }} />
        <div className="rounded-lg bg-surface-container-low p-3 flex items-start gap-2 min-h-[56px]">
          <Icon name="home_pin" className="text-[22px] text-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-label-sm text-label-sm text-outline uppercase">Pin location</div>
            <div className="font-body-md text-body-md text-on-surface truncate">{near ? `Near ${near.label}` : 'Search above or drag the map'}</div>
            {near?.sub && <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{near.sub}</div>}
          </div>
        </div>
        <PrimaryButton onClick={confirmPin}><Icon name="check_circle" className="text-[20px]" /><span>Confirm Location</span></PrimaryButton>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2 font-label-md text-label-md text-outline">
        <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center"><Icon name="check" className="text-[16px]" /></span> Find your home
        <span className="flex-1 h-px bg-surface-container" />
        <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center">2</span> Flat details
      </div>
      <div className="rounded-lg bg-verified-emerald-light p-3 flex items-center gap-2">
        <Icon name="where_to_vote" fill className="text-[22px] text-secondary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-label-md text-label-md text-secondary">Location pinned</div>
          <div className="font-body-sm text-body-sm text-on-surface-variant truncate">The nurse's Google Maps will lead to this exact pin</div>
        </div>
        <button type="button" onClick={() => setStep('pin')} className="font-label-md text-label-md text-primary underline flex-shrink-0">Change pin</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Flat / House no."><input className="field" value={f.line1} onChange={set('line1')} placeholder="C-402" required /></Field>
        <Field label="Sector">
          <select className="field" value={f.sector} onChange={set('sector')} required>
            <option value="">Choose</option>
            {SERVICE_SECTORS.map(s => <option key={s} value={s}>Sector {s}</option>)}
            <option value="0">Other area</option>
          </select>
        </Field>
      </div>
      {outside && (
        <div className="rounded-lg bg-amber-warning-light p-3 font-body-sm text-body-sm text-on-surface">
          Razano Rapid is live in {AREA_LABEL} right now. For other areas, <a className="text-primary underline font-bold" target="_blank" rel="noreferrer" href={waLink(RAZANO_WHATSAPP, 'Hi, I need a nurse visit outside Sectors 47–57. My area: ')}>WhatsApp us</a> and we'll try to help.
        </div>
      )}
      <Field label="Society / Building / Street"><input className="field" value={f.line2} onChange={set('line2')} placeholder="Nirvana Country, Aspen Greens" required /></Field>
      <Field label="Landmark / directions for the nurse (optional)"><input className="field" value={f.landmark} onChange={set('landmark')} placeholder="Gate 2, tower B lift, near clubhouse" /></Field>
      <Field label="Save as (optional)"><input className="field" value={f.label} onChange={set('label')} placeholder="Parents' home" /></Field>
      <PrimaryButton type="submit" busy={busy}>Save address</PrimaryButton>
      {initial.id && <button type="button" onClick={del} className="font-label-md text-label-md text-error py-2">Remove address</button>}
    </form>
  )
}
