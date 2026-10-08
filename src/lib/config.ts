const env = import.meta.env

export const SUPABASE_URL = (env.VITE_SUPABASE_URL as string) || ''
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY as string) || ''
export const RAZANO_WHATSAPP = (env.VITE_RAZANO_WHATSAPP as string) || '919560528775'
export const UPI_ID = (env.VITE_UPI_ID as string) || 'pratyaksh200@okaxis'
export const UPI_NAME = (env.VITE_UPI_NAME as string) || 'Razano Rapid'
export const GP_WHATSAPP = (env.VITE_GP_WHATSAPP as string) || ''
export const GP_NAME = (env.VITE_GP_NAME as string) || ''

export const SERVICE_SECTORS = [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57]
export const AREA_LABEL = 'Gurgaon Sectors 47–57'
export const EMERGENCY = '112'
export const MAP_CENTER: [number, number] = [28.418, 77.062] // Sector 50, Gurgaon
export const POLL_MS = 10000
