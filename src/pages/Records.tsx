import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TabPage } from '../components/AppShell'
import { EmptyCard, Icon, PrimaryButton, Spinner, StatusPill } from '../components/ui'
import { rpc } from '../lib/api'
import { useSession } from '../lib/session'
import { usePoll } from '../lib/useInterval'
import { dateTimeLabel, rupees } from '../lib/format'
import type { Status } from '../lib/types'

interface Row {
  id: string; ref: string; status: Status; mode: string; scheduled_at: string; completed_at: string | null
  patient: { name: string; age: number }; services: { name: string; icon: string }[]; total: number
  pay_status: string; rating: number | null; nurse_name: string | null
}

export default function Records() {
  const { user, ready, requireAuth } = useSession()
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const load = useCallback(() => { if (user) rpc<Row[]>('rr_my_bookings').then(setRows).catch(() => setRows(r => r ?? [])) }, [user])
  usePoll(load, 30000, !!user)

  return (
    <TabPage>
      <div className="px-margin-mobile pt-2 flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Visit Records</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Vitals, nurse notes and bills from every visit</p>
        </div>
        {ready && !user ? (
          <EmptyCard icon="clinical_notes" title="Your clinical records" text="Log in to see vitals and reports from every visit."
            action={<PrimaryButton onClick={() => requireAuth().catch(() => {})}>Log in</PrimaryButton>} />
        ) : rows === null ? (
          <div className="flex justify-center pt-10 text-primary"><Spinner className="text-[32px]" /></div>
        ) : rows.length === 0 ? (
          <EmptyCard icon="clinical_notes" title="No visits yet" text="After a visit, the vitals, notes and bill show up here."
            action={<PrimaryButton onClick={() => nav('/')}>Book a nurse</PrimaryButton>} />
        ) : rows.map(r => {
          const live = !['completed', 'cancelled'].includes(r.status)
          return (
            <Link key={r.id} to={live ? `/track/${r.id}` : `/visit/${r.id}`}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center flex-shrink-0">
                    <Icon name={r.services[0]?.icon || 'medical_services'} className="text-[22px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-label-lg text-label-lg text-on-surface truncate">{r.services.map(s => s.name).join(' + ')}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{r.patient.name} • {dateTimeLabel(r.completed_at || r.scheduled_at)}</div>
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-surface-container">
                <span className="font-body-sm text-body-sm text-outline">{r.ref}{r.nurse_name ? ` • ${r.nurse_name}` : ''}</span>
                <div className="flex items-center gap-2">
                  {r.status === 'completed' && r.pay_status !== 'paid' && <span className="font-label-sm text-label-sm text-tertiary-container bg-amber-warning-light px-1.5 py-0.5 rounded">{r.pay_status === 'claimed' ? 'VERIFYING' : 'UNPAID'}</span>}
                  <span className="font-label-lg text-label-lg text-on-surface">{rupees(r.total)}</span>
                  <Icon name="chevron_right" className="text-[20px] text-outline" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </TabPage>
  )
}
