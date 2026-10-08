import { useCallback, useState } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'
import { TabPage } from '../components/AppShell'
import { EmptyCard, Icon, Spinner } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll } from '../lib/useInterval'
import { dateTimeLabel, rupees } from '../lib/format'

interface Recent { id: string; ref: string; patient: { name: string }; services: { name: string }[]; completed_at: string; pay_status: string; total: number }
interface Home { today_completed: number; incentive: number; recent: Recent[] }

export default function NurseHistory() {
  const { user, ready } = useSession()
  const [h, setH] = useState<Home | null>(null)
  const load = useCallback(() => {
    if (user?.role === 'nurse') rpc<Home>('rr_nurse_home').then(setH).catch(e => toast.error(e.message))
  }, [user])
  usePoll(load, 30000, user?.role === 'nurse')

  if (ready && user?.role !== 'nurse') return <Navigate to="/nurse" replace />
  return (
    <TabPage>
      <div className="px-margin-mobile pt-2 flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Visit History</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Your completed visits and payments</p>
        </div>
        {!h ? <div className="flex justify-center pt-10 text-primary"><Spinner className="text-[32px]" /></div> : (<>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm">
              <div className="font-label-sm text-label-sm text-outline uppercase">Today</div>
              <div className="font-headline-sm text-headline-sm">{h.today_completed} visit{h.today_completed === 1 ? '' : 's'}</div>
            </div>
            <div className="bg-verified-emerald-light rounded-xl p-3 shadow-sm">
              <div className="font-label-sm text-label-sm text-secondary uppercase">Today's incentive</div>
              <div className="font-headline-sm text-headline-sm text-secondary">{rupees(h.today_completed * h.incentive)}</div>
            </div>
          </div>
          {h.recent.length === 0 ? (
            <EmptyCard icon="history" title="No visits yet" text="Completed visits will show here." />
          ) : h.recent.map(r => (
            <div key={r.id} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-verified-emerald-light text-secondary flex items-center justify-center flex-shrink-0">
                <Icon name="task_alt" className="text-[22px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-label-lg text-label-lg truncate">{r.patient.name} • {r.services.map(s => s.name).join(' + ')}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{r.ref} • {dateTimeLabel(r.completed_at)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-label-lg text-label-lg">{rupees(r.total)}</div>
                <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded ${r.pay_status === 'paid' ? 'bg-verified-emerald-light text-secondary' : 'bg-amber-warning-light text-tertiary-container'}`}>
                  {r.pay_status === 'paid' ? 'PAID' : r.pay_status === 'claimed' ? 'VERIFYING' : 'UNPAID'}
                </span>
              </div>
            </div>
          ))}
        </>)}
      </div>
    </TabPage>
  )
}
