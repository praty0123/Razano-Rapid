import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useSession } from '../lib/session'
import { liveEta } from '../lib/eta'
import { Avatar, Icon, Logo, Sheet } from './ui'
import { AuthSheet } from './AuthSheet'
import { PickerSheet } from './PickerSheet'
import { EMERGENCY, RAZANO_WHATSAPP } from '../lib/config'
import { waLink } from '../lib/format'

interface UI { openPicker: (focus?: 'patient' | 'address') => void; openSos: () => void }
const UICtx = createContext<UI>({ openPicker: () => {}, openSos: () => {} })
export const useUI = () => useContext(UICtx)

export function UIProvider({ children }: { children: ReactNode }) {
  const [picker, setPicker] = useState<null | 'patient' | 'address'>(null)
  const [sos, setSos] = useState(false)
  const { authOpen, closeAuth } = useSession()
  return (
    <UICtx.Provider value={{ openPicker: (f = 'patient') => setPicker(f), openSos: () => setSos(true) }}>
      {children}
      <AuthSheet open={authOpen} onClose={closeAuth} />
      <PickerSheet open={picker !== null} focus={picker ?? 'patient'} onClose={() => setPicker(null)} />
      <SosSheet open={sos} onClose={() => setSos(false)} />
    </UICtx.Provider>
  )
}

function SosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Emergency help">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-error-container p-3 flex gap-2">
          <Icon name="emergency_home" className="text-[22px] text-on-error-container flex-shrink-0" />
          <p className="font-body-sm text-body-sm text-on-error-container">
            Chest pain, breathing trouble, unconscious, fits, heavy bleeding or stroke signs? Call 112 for an ambulance now — don't wait for the nurse.
          </p>
        </div>
        <a href={`tel:${EMERGENCY}`} className="h-[52px] rounded-lg bg-vital-red text-on-error flex items-center justify-center gap-2 font-label-lg text-label-lg shadow-md active:scale-[0.98]">
          <Icon name="e911_emergency" className="text-[22px]" /> Call {EMERGENCY} (Ambulance)
        </a>
        <a href={waLink(RAZANO_WHATSAPP, 'Urgent: need help with a Razano Rapid visit')} target="_blank" rel="noreferrer"
          className="h-12 rounded-lg bg-verified-emerald-light text-secondary flex items-center justify-center gap-2 font-label-lg text-label-lg active:scale-[0.98]">
          <Icon name="chat" className="text-[20px]" /> WhatsApp Razano Rapid
        </a>
      </div>
    </Sheet>
  )
}

export function MainHeader() {
  const { user, addresses, addressId } = useSession()
  const { openPicker, openSos } = useUI()
  const nav = useNavigate()
  const addr = addresses.find(a => a.id === addressId)
  const isNurse = user?.role === 'nurse'
  const place = isNurse ? `Nurse partner • ${user?.sectors?.length ? 'Sectors ' + user.sectors.join(', ') : 'Sectors 47–57'}`
    : addr ? [addr.line2, addr.sector ? `Sector ${addr.sector}` : ''].filter(Boolean).join(', ') : 'Set visit address'
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] no-print">
      <div className="h-20 px-margin-mobile flex items-center justify-between gap-space-sm max-w-[560px] mx-auto">
        <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
          <Link to="/" aria-label="Razano Rapid home" className="self-start"><Logo className="h-10 w-auto -ml-1" /></Link>
            {isNurse ? (
              <div className="flex items-center gap-0.5 min-w-0">
                <Icon name="badge" className="text-[15px] text-secondary flex-shrink-0" />
                <span className="font-body-sm text-body-sm text-on-surface truncate">{place}</span>
              </div>
            ) : (
              <button aria-label="Change location" onClick={() => openPicker('address')} className="flex items-center gap-0.5 text-left min-w-0 group">
                <Icon name="location_on" className="text-[15px] text-primary flex-shrink-0" />
                <span className="font-body-sm text-body-sm text-on-surface truncate">{place}</span>
                <Icon name="expand_more" className="text-[16px] text-outline flex-shrink-0" />
              </button>
            )}
        </div>
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <SosButton onClick={openSos} />
          <button aria-label="Open profile" onClick={() => nav('/account')} className="w-11 h-11 flex items-center justify-center rounded-full hover:opacity-90 active:scale-95 transition-transform">
            {user ? <Avatar name={user.name} photo={user.photo} /> :
              <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center"><Icon name="person" className="text-[20px]" /></div>}
          </button>
        </div>
      </div>
    </header>
  )
}

function SosButton({ onClick, small = false }: { onClick: () => void; small?: boolean }) {
  return (
    <button aria-label="Emergency SOS Assistance" onClick={onClick}
      className={`${small ? 'h-10 px-2.5' : 'h-11 px-3'} rounded-full bg-vital-red text-on-error flex items-center justify-center gap-1 active:scale-95 transition-transform`}>
      <Icon name="e911_emergency" className={small ? 'text-[16px]' : 'text-[18px]'} />
      <span className={small ? 'font-label-sm text-label-sm' : 'font-label-md text-label-md'}>SOS</span>
    </button>
  )
}

export function BackHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { user } = useSession()
  const { openSos } = useUI()
  const nav = useNavigate()
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] no-print">
      <div className="h-16 px-margin-mobile flex items-center justify-between gap-space-sm max-w-[560px] mx-auto">
        <div className="flex items-center gap-space-sm min-w-0 flex-1">
          <button aria-label="Go back" onClick={onBack || (() => (history.length > 1 ? nav(-1) : nav('/')))}
            className="w-11 h-11 -ml-2 flex items-center justify-center text-on-surface active:scale-95 transition-transform flex-shrink-0">
            <Icon name="arrow_back" className="text-[24px]" />
          </button>
          <Logo variant="mark" className="h-8 w-auto" />
          <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-space-xs flex-shrink-0">
          <SosButton small onClick={openSos} />
          <button aria-label="Open profile" onClick={() => nav('/account')} className="w-11 h-11 flex items-center justify-center rounded-full active:scale-95 transition-transform">
            {user ? <Avatar name={user.name} photo={user.photo} /> :
              <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center"><Icon name="person" className="text-[20px]" /></div>}
          </button>
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  const { active, user } = useSession()
  const eta = active && active.status === 'accepted' ? liveEta(active).min : null
  const item = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center h-14 w-full transition-colors ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`

  if (user?.role === 'nurse') {
    return (
      <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(26,35,50,0.06)] no-print">
        <div className="grid grid-cols-3 items-center h-20 px-gutter-mobile max-w-[560px] mx-auto">
          <NavLink to="/nurse" end className={({ isActive }) => item(isActive)}>
            <div className="relative flex items-center justify-center">
              <Icon name="badge" className="text-[24px]" />
              {user.on_duty && <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim absolute -top-0.5 -right-1" />}
            </div>
            <span className="font-label-md text-label-md mt-1 text-center truncate">Visits</span>
          </NavLink>
          <NavLink to="/nurse/history" className={({ isActive }) => item(isActive)}>
            <Icon name="history" className="text-[24px]" />
            <span className="font-label-md text-label-md mt-1 text-center truncate">History</span>
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => item(isActive)}>
            <Icon name="person" className="text-[24px]" />
            <span className="font-label-md text-label-md mt-1 text-center truncate">Account</span>
          </NavLink>
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(26,35,50,0.06)] no-print">
      <div className="grid grid-cols-4 items-center h-20 px-gutter-mobile max-w-[560px] mx-auto">
        <NavLink to="/" end className={({ isActive }) => item(isActive)}>
          <Icon name="stethoscope" className="text-[24px]" />
          <span className="font-label-md text-label-md mt-1 text-center truncate">Book</span>
        </NavLink>
        <NavLink to="/track" className={({ isActive }) => item(isActive)}>
          <div className="relative flex items-center justify-center">
            <Icon name="moped" className="text-[24px]" />
            {eta != null && <span className="absolute -top-2 -right-6 px-1.5 py-0.5 rounded-full bg-amber-warning-light text-tertiary-container font-label-sm text-label-sm animate-pulse">{eta}m</span>}
            {eta == null && active && <span className="w-2 h-2 rounded-full bg-primary-container absolute -top-0.5 -right-1" />}
          </div>
          <span className="font-label-md text-label-md mt-1 text-center truncate">Live Track</span>
        </NavLink>
        <NavLink to="/records" className={({ isActive }) => item(isActive)}>
          <Icon name="clinical_notes" className="text-[24px]" />
          <span className="font-label-md text-label-md mt-1 text-center truncate">Records</span>
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => item(isActive)}>
          <Icon name="person" className="text-[24px]" />
          <span className="font-label-md text-label-md mt-1 text-center truncate">Account</span>
        </NavLink>
      </div>
    </nav>
  )
}

/** Standard tab page: header + content + bottom nav */
export function TabPage({ children }: { children: ReactNode }) {
  return (
    <>
      <MainHeader />
      <main className="flex flex-col relative w-full pt-20 pb-28 bg-surface max-w-[560px] mx-auto min-h-screen">
        <div className="flex flex-col w-full">{children}</div>
      </main>
      <BottomNav />
    </>
  )
}
