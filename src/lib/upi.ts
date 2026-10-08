import { UPI_ID, UPI_NAME } from './config'

export function upiParams(amount: number, note: string) {
  const p = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: amount.toFixed(2), cu: 'INR', tn: note.slice(0, 50) })
  return p.toString()
}
export function upiLink(amount: number, note: string, app?: 'gpay' | 'phonepe' | 'paytm') {
  const q = upiParams(amount, note)
  if (app === 'gpay') return `tez://upi/pay?${q}`
  if (app === 'phonepe') return `phonepe://pay?${q}`
  if (app === 'paytm') return `paytmmp://pay?${q}`
  return `upi://pay?${q}`
}
