import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

const TOKEN_KEY = 'rr_token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

export class ApiError extends Error {}

let onAuthLost: (() => void) | null = null
export function setAuthLostHandler(fn: () => void) { onAuthLost = fn }

/** Call a Supabase RPC function. Pass withToken=true to add p_token automatically. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}, withToken = true): Promise<T> {
  const body: Record<string, unknown> = { ...args }
  if (withToken) {
    const t = getToken()
    if (!t) { throw new ApiError('Please log in first') }
    body.p_token = t
  }
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('No internet connection. Please try again.')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg: string = data?.message || 'Something went wrong'
    if (msg === 'AUTH_REQUIRED') { setToken(null); onAuthLost?.(); throw new ApiError('Please log in again') }
    throw new ApiError(msg)
  }
  return data as T
}
