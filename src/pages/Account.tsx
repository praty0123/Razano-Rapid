import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { TabPage, useUI } from '../components/AppShell'
import { Avatar, EmptyCard, Field, Icon, PrimaryButton, Sheet } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { RAZANO_WHATSAPP } from '../lib/config'
import { addressLine, patientLine, waLink } from '../lib/format'

export default function Account() {
  const { user, ready, patients, addresses, logout, requireAuth, refresh } = useSession()
  const { openPicker } = useUI()
  const nav = useNavigate()
  const [edit, setEdit] = useState(false)
  const [pw, setPw] = useState(false)

  if (ready && !user) {
    return <TabPage><div className="px-margin-mobile pt-2">
      <EmptyCard icon="person" title="Your Razano Rapid account" text="Log in to book faster and see your visit records."
        action={<PrimaryButton onClick={() => requireAuth().catch(() => {})}>Log in / Sign up</PrimaryButton>} />
    </div></TabPage>
  }
  if (!user) return <TabPage><div /></TabPage>

  const row = (icon: string, label: string, onClick: () => void, sub?: string) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest shadow-sm text-left active:scale-[0.99]">
      <div className="w-10 h-10 rounded-full bg-surface-container-low text-primary flex items-center justify-center"><Icon name={icon} className="text-[22px]" /></div>
      <div className="flex-1 min-w-0"><div className="font-label-lg text-label-lg">{label}</div>{sub && <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{sub}</div>}</div>
      <Icon name="chevron_right" className="text-[20px] text-outline" />
    </button>
  )

  return (
    <TabPage>
      <div className="px-margin-mobile pt-2 flex flex-col gap-space-md">
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-3">
          <Avatar name={user.name} photo={user.photo} className="w-14 h-14" textClass="text-headline-sm" />
          <div className="min-w-0 flex-1">
            <div className="font-headline-sm text-headline-sm truncate">{user.name}</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant">+91 {user.phone}{user.email ? ` • ${user.email}` : ''}</div>
            <span className="font-label-sm text-label-sm uppercase bg-primary-fixed text-on-primary-fixed px-1.5 py-0.5 rounded">{user.role === 'customer' ? 'Family' : user.role}</span>
          </div>
          <button onClick={() => setEdit(true)} className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center"><Icon name="edit" className="text-[20px]" /></button>
        </div>

        {user.role === 'admin' && row('admin_panel_settings', 'Admin panel', () => nav('/admin'), 'Bookings, nurses, payments')}
        {user.role === 'nurse' && row('badge', 'Nurse Mode', () => nav('/nurse'), 'Go on duty and see visits')}

        {user.role !== 'nurse' && (<>
          <div className="font-label-md text-label-md text-outline uppercase tracking-wider pt-1">Patients</div>
          {patients.length ? patients.map(p => row('elderly', patientLine(p), () => openPicker('patient'), p.notes || p.relation || '')) : row('person_add', 'Add a patient', () => openPicker('patient'))}
          <div className="font-label-md text-label-md text-outline uppercase tracking-wider pt-1">Addresses</div>
          {addresses.length ? addresses.map(a => row('home_pin', a.label || a.line2 || 'Address', () => openPicker('address'), addressLine(a))) : row('add_location', 'Add an address', () => openPicker('address'))}
        </>)}

        <div className="font-label-md text-label-md text-outline uppercase tracking-wider pt-1">Help</div>
        {row('chat', 'WhatsApp Razano Rapid', () => window.open(waLink(RAZANO_WHATSAPP, 'Hi Razano Rapid, I need help with '), '_blank'), '+91 95605 28775')}
        {row('lock', 'Change password', () => setPw(true))}
        {row('policy', 'Terms & Privacy', () => nav('/privacy'))}
        <button onClick={async () => { await logout(); toast('Logged out'); nav('/') }} className="h-12 rounded-lg bg-error-container text-on-error-container font-label-lg text-label-lg mb-4">Log out</button>
        <p className="text-center font-label-sm text-label-sm text-outline pb-2">Razano Rapid by Sevora Care Pvt Ltd • <Link to="/" className="underline">razanorapid.in</Link></p>
      </div>
      <ProfileSheet open={edit} onClose={() => setEdit(false)} onSaved={refresh} />
      <PasswordSheet open={pw} onClose={() => setPw(false)} />
    </TabPage>
  )
}

function ProfileSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open && user) { setName(user.name); setEmail(user.email || '') } }, [open, user])
  const save = async () => {
    setBusy(true)
    try { await rpc('rr_update_profile', { p_name: name, p_email: email }); onSaved(); toast.success('Saved'); onClose() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Your details">
      <div className="flex flex-col gap-3">
        <Field label="Name"><input className="field" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Email (optional, for reports)"><input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <PrimaryButton busy={busy} onClick={save}>Save</PrimaryButton>
      </div>
    </Sheet>
  )
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [a, setA] = useState(''), [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await rpc('rr_change_password', { p_old: a, p_new: b }); toast.success('Password changed'); setA(''); setB(''); onClose() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      <div className="flex flex-col gap-3">
        <Field label="Current password"><input className="field" type="password" value={a} onChange={e => setA(e.target.value)} /></Field>
        <Field label="New password (min 6)"><input className="field" type="password" value={b} onChange={e => setB(e.target.value)} /></Field>
        <PrimaryButton busy={busy} onClick={save}>Change password</PrimaryButton>
      </div>
    </Sheet>
  )
}
