import { useEffect, type ReactNode } from 'react'
import { initials } from '../lib/format'
import type { Status } from '../lib/types'

export function Icon({ name, className = '', fill = false, style }: { name: string; className?: string; fill?: boolean; style?: React.CSSProperties }) {
  return <span aria-hidden className={`material-symbols-outlined ${fill ? 'icon-fill' : ''} ${className}`} style={style}>{name}</span>
}

export function Spinner({ className = 'text-[18px]' }: { className?: string }) {
  return <Icon name="progress_activity" className={`animate-spin ${className}`} />
}

/** Brand logo: full wordmark (/razano_logo.png) or heart mark (/logo-mark.png). */
export function Logo({ className = 'h-10 w-auto', variant = 'full' }: { className?: string; variant?: 'full' | 'mark' }) {
  return <img alt="Razano Rapid" className={`${className} object-contain flex-shrink-0`} src={variant === 'full' ? '/razano_logo.png' : '/logo-mark.png'} />
}

export function Avatar({ name, photo, className = 'w-8 h-8', textClass = 'text-label-md' }: { name?: string | null; photo?: string | null; className?: string; textClass?: string }) {
  if (photo) return <img alt={name || ''} className={`${className} rounded-full object-cover`} src={photo} />
  return (
    <div className={`${className} rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-md ${textClass}`}>
      {initials(name)}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, footer, tall = false }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="rr-scrim absolute inset-0 bg-[#1A2332]/40" onClick={onClose} />
      <div className={`rr-sheet relative bg-surface rounded-t-[20px] shadow-[0_20px_30px_-10px_rgba(26,35,50,0.16)] flex flex-col ${tall ? 'h-[92vh]' : 'max-h-[92vh]'} w-full max-w-[560px] mx-auto pb-safe`}>
        <div className="flex items-center justify-between px-margin-mobile pt-3 pb-2">
          <div className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</div>
          <button aria-label="Close" onClick={onClose} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-on-surface-variant active:scale-95">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <div className="overflow-y-auto px-margin-mobile pb-4 flex-1">{children}</div>
        {footer && <div className="px-margin-mobile py-3 border-t border-surface-container bg-surface">{footer}</div>}
      </div>
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, busy, className = '', type = 'button', tone = 'primary' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; className?: string; type?: 'button' | 'submit'; tone?: 'primary' | 'secondary' | 'danger'
}) {
  const bg = tone === 'secondary' ? 'bg-secondary text-on-secondary' : tone === 'danger' ? 'bg-vital-red text-on-error' : 'bg-primary text-on-primary'
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy}
      className={`w-full h-[52px] rounded-lg ${bg} font-label-lg text-label-lg flex items-center justify-center gap-space-xs active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:active:scale-100 ${className}`}>
      {busy ? <Spinner /> : children}
    </button>
  )
}

export function OutlineButton({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full h-12 rounded-lg border-[1.5px] border-primary-container bg-surface-container-lowest text-primary-container font-label-lg text-label-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all ${className}`}>
      {children}
    </button>
  )
}

export const STATUS_TEXT: Record<Status, string> = {
  waiting: 'Finding nurse', assigned: 'Nurse assigned', accepted: 'Nurse on the way', arrived: 'Nurse arrived',
  in_progress: 'In procedure', completed: 'Completed', cancelled: 'Cancelled',
}

export function StatusPill({ status }: { status: Status }) {
  const cls = status === 'completed' ? 'bg-verified-emerald-light text-secondary'
    : status === 'cancelled' ? 'bg-error-container text-on-error-container'
    : status === 'waiting' ? 'bg-amber-warning-light text-tertiary-container'
    : 'bg-primary-fixed text-on-primary-fixed'
  return <span className={`font-label-sm text-label-sm uppercase px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${cls}`}>{STATUS_TEXT[status]}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}

export function EmptyCard({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col items-center text-center gap-2">
      <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
        <Icon name={icon} className="text-[28px]" />
      </div>
      <div className="font-headline-sm text-headline-sm text-on-surface">{title}</div>
      <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[300px]">{text}</p>
      {action && <div className="w-full pt-2">{action}</div>}
    </div>
  )
}
