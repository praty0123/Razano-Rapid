import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { rpc } from '../lib/api'
import { UPI_ID } from '../lib/config'
import { rupees } from '../lib/format'
import { upiLink } from '../lib/upi'
import type { Booking } from '../lib/types'
import { Icon } from './ui'

const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export function UpiPayCard({ booking, onUpdated, flat = false }: { booking: Booking; onUpdated: (b: Booking) => void; flat?: boolean }) {
  const [app, setApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr' | null>(isMobile ? null : 'qr')
  const [qr, setQr] = useState<string | null>(null)
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState(false)
  const note = `Razano Rapid ${booking.ref}`

  useEffect(() => {
    if (app !== 'qr') return
    QRCode.toDataURL(upiLink(booking.total, note), { margin: 1, width: 360, color: { dark: '#131c2a' } }).then(setQr).catch(() => {})
  }, [app, booking.total, note])

  const pay = () => {
    if (app === 'qr') return
    setOpened(true)
    window.location.href = upiLink(booking.total, note, app === null ? undefined : app)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(UPI_ID); toast.success('UPI ID copied') } catch { toast(UPI_ID) }
  }
  const claim = async () => {
    setBusy(true)
    try { onUpdated(await rpc<Booking>('rr_claim_payment', { p_id: booking.id, p_ref: ref })); toast.success('Thanks! We\'ll confirm your payment shortly.') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const wrap = flat ? 'flex flex-col gap-space-md' : 'bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-md'

  if (booking.pay_status !== 'unpaid') {
    return (
      <div className={wrap}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-verified-emerald-light text-secondary flex items-center justify-center"><Icon name={booking.pay_status === 'paid' ? 'check_circle' : 'hourglass_top'} fill className="text-[24px]" /></div>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface">{booking.pay_status === 'paid' ? `${rupees(booking.total)} paid` : 'Payment being confirmed'}</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {booking.pay_status === 'paid' ? `Received${booking.paid_via ? ' via ' + booking.paid_via.toUpperCase() : ''}. Thank you!` : `We'll match your UPI payment${booking.pay_ref ? ` (Ref ${booking.pay_ref})` : ''} and confirm.`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const btn = (key: typeof app, label: string, logo: React.ReactNode) => (
    <button type="button" onClick={() => setApp(key)}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 text-center gap-1 ${app === key ? 'bg-surface-container-high ring-2 ring-primary-container' : 'bg-surface-container-low hover:bg-surface-container'}`}>
      <div className="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center">{logo}</div>
      <span className="font-label-sm text-label-sm text-on-surface">{label}</span>
    </button>
  )

  return (
    <div className={wrap}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Instant UPI Pay</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Pay from any UPI app</p>
        </div>
        <div className="flex items-center gap-1 text-primary">
          <Icon name="bolt" className="text-[18px]" />
          <span className="font-label-sm text-label-sm">{rupees(booking.total)}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {btn('gpay', 'GPay', <span className="font-headline-sm text-[16px] text-primary">G</span>)}
        {btn('phonepe', 'PhonePe', <span className="font-headline-sm text-[16px] text-secondary">Pe</span>)}
        {btn('paytm', 'Paytm', <span className="font-headline-sm text-[14px] text-electric-cerulean font-bold">Paytm</span>)}
        {btn('qr', 'Scan QR', <Icon name="qr_code_2" className="text-[20px] text-tertiary" />)}
      </div>
      {app === 'qr' && (
        <div className="flex flex-col items-center gap-1 bg-surface-container-low rounded-lg p-3">
          {qr ? <img src={qr} alt="UPI QR code" className="w-44 h-44 rounded-lg bg-white p-1" /> : <div className="w-44 h-44" />}
          <span className="font-body-sm text-body-sm text-on-surface-variant text-center">Scan with any UPI app from another phone</span>
        </div>
      )}
      <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <Icon name="account_balance_wallet" className="text-[20px] text-outline" />
          <span className="font-body-sm text-body-sm text-on-surface truncate">Pay to: <strong>{UPI_ID}</strong></span>
        </div>
        <button type="button" onClick={copy} className="font-label-sm text-label-sm text-secondary bg-verified-emerald-light px-2 py-1 rounded">Copy</button>
      </div>
      {app !== 'qr' && (
        <button type="button" onClick={pay} className="w-full h-[52px] bg-primary text-on-primary rounded-xl flex items-center justify-between px-space-md shadow-md active:scale-[0.98] transition-all">
          <div className="flex items-center gap-space-sm">
            <Icon name="lock" className="text-[24px]" />
            <span className="font-label-lg text-label-lg">Pay {rupees(booking.total)}{app ? ` via ${app === 'gpay' ? 'GPay' : app === 'phonepe' ? 'PhonePe' : 'Paytm'}` : ' Securely'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-label-sm text-label-sm opacity-90">1-Tap UPI</span>
            <Icon name="arrow_forward" className="text-[18px]" />
          </div>
        </button>
      )}
      <div className={`flex flex-col gap-2 pt-1 ${opened || app === 'qr' ? '' : 'opacity-90'}`}>
        <span className="font-label-md text-label-md text-on-surface">Paid? Tell us so we can confirm</span>
        <div className="flex gap-2">
          <input className="field flex-1" value={ref} onChange={e => setRef(e.target.value)} placeholder="UPI ref no. (optional)" inputMode="numeric" />
          <button type="button" onClick={claim} disabled={busy} className="h-12 px-4 rounded-lg bg-secondary text-on-secondary font-label-lg text-label-lg flex-shrink-0 active:scale-95 disabled:opacity-60">
            {busy ? '...' : "I've paid"}
          </button>
        </div>
      </div>
    </div>
  )
}
