import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, getToken, rpc, setAuthLostHandler, setToken } from './api'
import type { Address, Booking, Patient, User } from './types'
import { usePoll } from './useInterval'

type AuthWaiter = { resolve: (u: User) => void; reject: (e: Error) => void }

interface SessionCtx {
  user: User | null
  ready: boolean
  patients: Patient[]
  addresses: Address[]
  active: Booking | null
  patientId: string | null
  addressId: string | null
  setPatientId: (id: string | null) => void
  setAddressId: (id: string | null) => void
  refresh: () => Promise<void>
  refreshActive: () => Promise<void>
  login: (login: string, password: string) => Promise<User>
  signup: (name: string, phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  /** Opens the login sheet if needed; resolves with the user once logged in. */
  requireAuth: () => Promise<User>
  authOpen: boolean
  closeAuth: () => void
}

const Ctx = createContext<SessionCtx>(null as unknown as SessionCtx)
export const useSession = () => useContext(Ctx)

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch { /* ignore */ } },
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [active, setActive] = useState<Booking | null>(null)
  const [patientId, setPid] = useState<string | null>(store.get('rr_patient'))
  const [addressId, setAid] = useState<string | null>(store.get('rr_address'))
  const [authOpen, setAuthOpen] = useState(false)
  const waiters = useRef<AuthWaiter[]>([])

  const setPatientId = (id: string | null) => { setPid(id); store.set('rr_patient', id) }
  const setAddressId = (id: string | null) => { setAid(id); store.set('rr_address', id) }

  const clear = useCallback(() => {
    setUser(null); setPatients([]); setAddresses([]); setActive(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!getToken()) { clear(); setReady(true); return }
    try {
      const r = await rpc<{ user: User; patients: Patient[]; addresses: Address[] }>('rr_me')
      setUser(r.user); setPatients(r.patients); setAddresses(r.addresses)
    } catch (e) {
      if (!(e instanceof ApiError) || !getToken()) clear()
    } finally { setReady(true) }
  }, [clear])

  const refreshActive = useCallback(async () => {
    if (!getToken()) return
    try { setActive(await rpc<Booking | null>('rr_my_active')) } catch { /* offline */ }
  }, [])

  useEffect(() => { setAuthLostHandler(clear); refresh() }, [refresh, clear])
  usePoll(refreshActive, 15000, !!user)

  // keep selected patient/address valid
  useEffect(() => {
    if (!user) return
    if (!patients.find(p => p.id === patientId)) setPatientId(patients[0]?.id ?? null)
    if (!addresses.find(a => a.id === addressId)) setAddressId(addresses[addresses.length - 1]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, patients, addresses])

  const finishAuth = useCallback(async (token: string, u: User) => {
    setToken(token); setUser(u)
    await refresh(); refreshActive()
    setAuthOpen(false)
    waiters.current.splice(0).forEach(w => w.resolve(u))
    return u
  }, [refresh, refreshActive])

  const login = useCallback(async (l: string, p: string) => {
    const r = await rpc<{ token?: string; user?: User; error?: string }>('rr_login', { p_login: l, p_password: p }, false)
    if (r.error || !r.token || !r.user) throw new ApiError(r.error || 'Login failed')
    return finishAuth(r.token, r.user)
  }, [finishAuth])

  const signup = useCallback(async (n: string, ph: string, p: string) => {
    const r = await rpc<{ token: string; user: User }>('rr_signup', { p_name: n, p_phone: ph, p_password: p }, false)
    return finishAuth(r.token, r.user)
  }, [finishAuth])

  const logout = useCallback(async () => {
    try { await rpc('rr_logout') } catch { /* ignore */ }
    setToken(null); clear()
  }, [clear])

  const requireAuth = useCallback(() => {
    if (user) return Promise.resolve(user)
    setAuthOpen(true)
    return new Promise<User>((resolve, reject) => waiters.current.push({ resolve, reject }))
  }, [user])

  const closeAuth = useCallback(() => {
    setAuthOpen(false)
    waiters.current.splice(0).forEach(w => w.reject(new Error('cancelled')))
  }, [])

  const value = useMemo<SessionCtx>(() => ({
    user, ready, patients, addresses, active, patientId, addressId, setPatientId, setAddressId,
    refresh, refreshActive, login, signup, logout, requireAuth, authOpen, closeAuth,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, ready, patients, addresses, active, patientId, addressId, refresh, refreshActive, login, signup, logout, requireAuth, authOpen, closeAuth])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
