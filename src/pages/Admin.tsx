import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BackHeader } from '../components/AppShell'
import { Avatar, EmptyCard, Field, Icon, PrimaryButton, Sheet, Spinner, StatusPill } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll } from '../lib/useInterval'
import { compressImage } from '../lib/image'
import { addressLine, agoLabel, dateTimeLabel, rupees, telLink, waLink } from '../lib/format'
import type { Booking, User } from '../lib/types'

type AdminUser = User & { visits: number; rating_avg: number | null; loc_at: string | null; created_at: string }
interface Stats { today_visits: number; today_revenue: number; month_visits: number; month_revenue: number; active: number; waiting: number; unpaid: number; customers: number; nurses_on_duty: number }

export default function Admin() {
  const { user, ready, requireAuth } = useSession()
  if (ready && (!user || user.role !== 'admin')) {
    return (<>
      <BackHeader title="Admin" />
      <main className="pt-20 px-margin-mobile max-w-[560px] mx-auto">
        <EmptyCard icon="admin_panel_settings" title="Admin only" text={user ? 'This account is not an admin.' : 'Log in with the admin account.'}
          action={!user ? <PrimaryButton onClick={() => requireAuth().catch(() => {})}>Log in</PrimaryButton> : undefined} />
      </main>
    </>)
  }
  if (!user) return null
  return <AdminHome />
}

function AdminHome() {
  const [tab, setTab] = useState<'bookings' | 'nurses' | 'customers'>('bookings')
  const [scope, setScope] = useState<'active' | 'today' | 'unpaid' | 'all'>('active')
  const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<Booking[] | null>(null)
  const [nurses, setNurses] = useState<AdminUser[]>([])
  const [customers, setCustomers] = useState<AdminUser[]>([])
  const [edit, setEdit] = useState<Partial<AdminUser> | null>(null)
  const [rxImg, setRxImg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, b, n] = await Promise.all([
        rpc<Stats>('rr_admin_stats'), rpc<Booking[]>('rr_admin_bookings', { p_scope: scope }), rpc<AdminUser[]>('rr_admin_users', { p_role: 'nurse' }),
      ])
      setStats(s); setRows(b); setNurses(n)
      if (tab === 'customers') setCustomers(await rpc<AdminUser[]>('rr_admin_users', { p_role: 'customer' }))
    } catch (e) { toast.error((e as Error).message) }
  }, [scope, tab])
  usePoll(load, 15000)

  const update = async (b: Booking, p: Record<string, unknown>) => {
    try { await rpc('rr_admin_booking_update', { p_id: b.id, p }); toast.success('Updated'); load() } catch (e) { toast.error((e as Error).message) }
  }
  const cancel = async (b: Booking) => {
    const reason = prompt('Reason for cancelling?', 'Cancelled by Razano')
    if (reason === null) return
    try { await rpc('rr_cancel', { p_id: b.id, p_reason: reason }); load() } catch (e) { toast.error((e as Error).message) }
  }
  const viewRx = async (b: Booking) => {
    try { const r = await rpc<{ image: string } | null>('rr_rx_get', { p_id: b.id }); r?.image ? setRxImg(r.image) : toast('No prescription photo yet') }
    catch (e) { toast.error((e as Error).message) }
  }
  const resetPw = async (u: AdminUser) => {
    const pw = prompt(`New password for ${u.name} (min 6 characters)`)
    if (!pw) return
    try { await rpc('rr_admin_reset_password', { p_user: u.id, p_password: pw }); toast.success('Password reset. Share it with them on WhatsApp.') } catch (e) { toast.error((e as Error).message) }
  }

  const chip = (on: boolean) => `px-3 h-9 rounded-full font-label-md text-label-md border flex-shrink-0 ${on ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface-container-lowest border-[#E2E8F0] text-on-surface'}`

  return (
    <>
      <BackHeader title="Razano Rapid Admin" />
      <main className="pt-20 pb-10 px-margin-mobile max-w-[560px] mx-auto flex flex-col gap-space-md">
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Today" value={`${stats.today_visits} • ${rupees(stats.today_revenue)}`} />
            <Stat label="This month" value={`${stats.month_visits} • ${rupees(stats.month_revenue)}`} />
            <Stat label="Unpaid" value={rupees(stats.unpaid)} warn={stats.unpaid > 0} />
            <Stat label="Live visits" value={String(stats.active)} />
            <Stat label="Waiting" value={String(stats.waiting)} warn={stats.waiting > 0} />
            <Stat label="On duty" value={`${stats.nurses_on_duty} nurse${stats.nurses_on_duty === 1 ? '' : 's'}`} warn={stats.nurses_on_duty === 0} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 p-1 bg-surface-container-low rounded-lg">
          {(['bookings', 'nurses', 'customers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`py-2.5 rounded font-label-md text-label-md capitalize ${tab === t ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>{t}</button>
          ))}
        </div>

        {tab === 'bookings' && (<>
          <div className="flex gap-1.5 overflow-x-auto">
            {([['active', 'Live'], ['today', 'Today'], ['unpaid', 'Payments'], ['all', 'All']] as const).map(([k, l]) => (
              <button key={k} className={chip(scope === k)} onClick={() => { setScope(k); setRows(null) }}>{l}</button>
            ))}
          </div>
          {rows === null ? <div className="flex justify-center py-8 text-primary"><Spinner className="text-[28px]" /></div>
            : rows.length === 0 ? <p className="text-center font-body-md text-body-md text-on-surface-variant py-6">Nothing here.</p>
            : rows.map(b => (
              <div key={b.id} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-label-lg text-label-lg">{b.ref} • {b.mode === 'now' ? 'Rapid' : 'Scheduled'}</div>
                  <StatusPill status={b.status} />
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{dateTimeLabel(b.scheduled_at)} • booked {agoLabel(b.created_at)}</div>
                <div className="font-label-lg text-label-lg text-on-surface">{b.patient.name} ({b.patient.age}{b.patient.gender ? ' ' + b.patient.gender : ''}){b.patient.notes ? ` — ${b.patient.notes}` : ''}</div>
                <div className="font-body-sm text-body-sm text-on-surface">{addressLine(b.address)}{b.address.landmark ? ` • ${b.address.landmark}` : ''}</div>
                <div className="font-body-sm text-body-sm text-on-surface">{b.services.map(s => s.name).join(' + ')} • <strong>{rupees(b.total)}</strong></div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${b.pay_status === 'paid' ? 'bg-verified-emerald-light text-secondary' : 'bg-amber-warning-light text-tertiary-container'}`}>
                    {b.pay_status === 'paid' ? `PAID ${b.paid_via?.toUpperCase() || ''}` : b.pay_status === 'claimed' ? `CLAIMED${b.pay_ref ? ' • ' + b.pay_ref : ''}` : `UNPAID (${b.pay_method === 'now' ? 'pay now' : 'pay after'})`}
                  </span>
                  {b.needs_rx && <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed">Rx: {b.rx?.status || 'none'}{b.rx?.doctor_name ? ` (${b.rx.doctor_name})` : ''}</span>}
                  {b.rating && <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">★ {b.rating}</span>}
                </div>
                {b.customer && (
                  <div className="flex items-center gap-2 font-body-sm text-body-sm">
                    <span>Family: {b.customer.name}</span>
                    <a className="text-primary underline" href={telLink(b.customer.phone)}>{b.customer.phone}</a>
                    <a className="text-secondary underline" target="_blank" rel="noreferrer" href={waLink(b.customer.phone, `Namaste ${b.customer.name.split(' ')[0]} ji, Razano Rapid se — visit ${b.ref} ke baare mein.`)}>WhatsApp</a>
                  </div>
                )}
                {!['completed', 'cancelled'].includes(b.status) && (
                  <Field label="Nurse">
                    <select className="field" value={b.nurse_id || ''} onChange={e => update(b, { nurse_id: e.target.value })}>
                      <option value="">— Unassigned (waiting) —</option>
                      {nurses.filter(n => n.active).map(n => <option key={n.id} value={n.id}>{n.name}{n.on_duty ? ' (on duty)' : ''}</option>)}
                    </select>
                  </Field>
                )}
                {['completed', 'cancelled'].includes(b.status) && b.nurse_name && <div className="font-body-sm text-body-sm text-on-surface-variant">Nurse: {b.nurse_name}</div>}
                {b.procedure_note && <div className="font-body-sm text-body-sm bg-surface-container-low rounded p-2">{b.procedure_note}{b.nurse_notes ? ` — ${b.nurse_notes}` : ''}</div>}
                <div className="flex gap-2 flex-wrap pt-1">
                  {b.pay_status !== 'paid' && b.status !== 'cancelled' && (<>
                    <button onClick={() => update(b, { pay_status: 'paid', paid_via: 'upi' })} className="px-3 h-9 rounded-lg bg-verified-emerald-light text-secondary font-label-md text-label-md">Mark paid (UPI)</button>
                    <button onClick={() => update(b, { pay_status: 'paid', paid_via: 'cash' })} className="px-3 h-9 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md">Cash</button>
                  </>)}
                  {b.rx?.has_image && <button onClick={() => viewRx(b)} className="px-3 h-9 rounded-lg bg-primary-fixed text-on-primary-fixed font-label-md text-label-md">View Rx</button>}
                  <a href={`/visit/${b.id}`} className="px-3 h-9 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center">Report</a>
                  {!['completed', 'cancelled'].includes(b.status) && <button onClick={() => cancel(b)} className="px-3 h-9 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md">Cancel</button>}
                </div>
              </div>
            ))}
        </>)}

        {tab === 'nurses' && (<>
          <PrimaryButton onClick={() => setEdit({ verified: false, active: true })}><Icon name="person_add" className="text-[20px]" />Add nurse</PrimaryButton>
          {nurses.length === 0 && <p className="text-center font-body-md text-body-md text-on-surface-variant">No nurses yet. Add your first nurse.</p>}
          {nurses.map(n => (
            <div key={n.id} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-3">
              <Avatar name={n.name} photo={n.photo} className="w-12 h-12" />
              <div className="min-w-0 flex-1">
                <div className="font-label-lg text-label-lg flex items-center gap-1.5">{n.name}
                  {n.verified && <Icon name="verified" className="text-[16px] text-secondary" />}
                  {!n.active && <span className="font-label-sm text-label-sm text-error">DISABLED</span>}
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{n.phone} • {n.qualification || '—'} • {n.visits} visits{n.rating_avg ? ` • ★${n.rating_avg}` : ''}</div>
                <div className="font-body-sm text-body-sm">{n.on_duty ? <span className="text-secondary font-bold">On duty</span> : <span className="text-outline">Off duty</span>}{n.loc_at ? ` • GPS ${agoLabel(n.loc_at)}` : ''}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEdit(n)} className="px-3 h-8 rounded bg-surface-container text-primary font-label-md text-label-md">Edit</button>
                <button onClick={() => resetPw(n)} className="px-3 h-8 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Password</button>
              </div>
            </div>
          ))}
        </>)}

        {tab === 'customers' && (customers.length === 0 ? <p className="text-center font-body-md text-body-md text-on-surface-variant py-6">No customers yet.</p> :
          customers.map(c => (
            <div key={c.id} className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-label-lg text-label-lg">{c.name}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{c.phone} • {c.visits} visits • joined {dateTimeLabel(c.created_at).split(',')[0]}</div>
              </div>
              <div className="flex gap-1">
                <a href={waLink(c.phone, `Namaste ${c.name.split(' ')[0]} ji, Razano Rapid se baat kar rahe hain.`)} target="_blank" rel="noreferrer" className="px-2 h-8 rounded bg-verified-emerald-light text-secondary font-label-sm text-label-sm flex items-center">WA</a>
                <button onClick={() => resetPw(c)} className="px-2 h-8 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Reset PW</button>
              </div>
            </div>
          )))}
      </main>
      <NurseForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />
      <Sheet open={!!rxImg} onClose={() => setRxImg(null)} title="Prescription">
        {rxImg && <img src={rxImg} alt="Prescription" className="w-full rounded-lg" />}
      </Sheet>
    </>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 shadow-sm ${warn ? 'bg-amber-warning-light' : 'bg-surface-container-lowest'}`}>
      <div className="font-label-sm text-label-sm text-outline uppercase">{label}</div>
      <div className="font-label-lg text-label-lg text-on-surface">{value}</div>
    </div>
  )
}

function NurseForm({ initial, onClose, onSaved }: { initial: Partial<AdminUser> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (initial) setF({ ...initial, password: '', sectors: (initial.sectors || []).join(', ') })
  }, [initial])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const photo = async (file: File) => { try { setF({ ...f, photo: await compressImage(file, 320, 0.8) }) } catch (e) { toast.error((e as Error).message) } }
  const save = async () => {
    setBusy(true)
    try {
      const sectors = String(f.sectors || '').split(/[,\s]+/).map(Number).filter(Boolean)
      await rpc('rr_admin_save_nurse', { p: { ...f, sectors } })
      toast.success('Nurse saved'); onSaved()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={!!initial} onClose={onClose} title={initial?.id ? 'Edit nurse' : 'Add nurse'} tall
      footer={<PrimaryButton busy={busy} onClick={save}>Save nurse</PrimaryButton>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={f.name} photo={f.photo} className="w-16 h-16" />
          <label className="px-3 h-10 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center cursor-pointer">
            Upload photo<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && photo(e.target.files[0])} />
          </label>
        </div>
        <Field label="Full name"><input className="field" value={f.name || ''} onChange={set('name')} /></Field>
        <Field label="Mobile (login)"><input className="field" inputMode="tel" value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Email (optional)"><input className="field" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label={initial?.id ? 'New password (leave blank to keep)' : 'Password (min 6)'}><input className="field" value={f.password || ''} onChange={set('password')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qualification"><input className="field" value={f.qualification || ''} onChange={set('qualification')} placeholder="GNM" /></Field>
          <Field label="Nursing reg. no."><input className="field" value={f.reg_no || ''} onChange={set('reg_no')} placeholder="HNC-..." /></Field>
        </div>
        <Field label="Bike (shown to family)"><input className="field" value={f.vehicle || ''} onChange={set('vehicle')} placeholder="Honda Activa • HR-26-XX-0000" /></Field>
        <Field label="Sectors covered (blank = all 47–57)"><input className="field" value={f.sectors || ''} onChange={set('sectors')} placeholder="47, 48, 49, 50" /></Field>
        <label className="flex items-center gap-2 font-label-lg text-label-lg"><input type="checkbox" className="w-5 h-5 accent-primary" checked={!!f.verified} onChange={set('verified')} />
          Verified (registration + police check done)</label>
        <label className="flex items-center gap-2 font-label-lg text-label-lg"><input type="checkbox" className="w-5 h-5 accent-primary" checked={f.active !== false} onChange={set('active')} />
          Account active</label>
      </div>
    </Sheet>
  )
}
