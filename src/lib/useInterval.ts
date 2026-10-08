import { useEffect, useRef } from 'react'

/** Runs fn now and every `ms` while the tab is visible; re-runs immediately when the tab comes back. */
export function usePoll(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!enabled) return
    ref.current()
    const id = setInterval(() => { if (document.visibilityState === 'visible') ref.current() }, ms)
    const onVis = () => { if (document.visibilityState === 'visible') ref.current() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [ms, enabled])
}

export function useNow(ms = 1000) {
  const [, force] = useStateTick()
  useEffect(() => { const id = setInterval(force, ms); return () => clearInterval(id) }, [ms, force])
  return Date.now()
}
import { useCallback, useState } from 'react'
function useStateTick(): [number, () => void] {
  const [n, set] = useState(0)
  return [n, useCallback(() => set(x => x + 1), [])]
}
