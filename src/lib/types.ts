export type Role = 'customer' | 'nurse' | 'admin'
export interface User {
  id: string; role: Role; name: string; phone: string; email: string | null
  qualification: string | null; reg_no: string | null; vehicle: string | null
  verified: boolean; on_duty: boolean; sectors: number[] | null; photo: string | null; active: boolean
}
export interface Patient { id: string; name: string; age: number; gender: string | null; relation: string | null; notes: string | null }
export interface Address {
  id: string; label: string | null; line1: string; line2: string | null; sector: number | null
  landmark: string | null; lat: number | null; lng: number | null
}
export interface Service {
  code: string; name: string; description: string; price: number; minutes: number
  icon: string; needs_rx: boolean; popular: boolean
}
export interface NursePublic {
  id: string; name: string; qualification: string | null; reg_no: string | null; photo: string | null
  phone: string; vehicle: string | null; verified: boolean; rating_avg: number | null; rating_count: number
  visits: number; lat: number | null; lng: number | null; loc_at: string | null
}
export type Status = 'waiting' | 'assigned' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
export interface Vitals { bp_sys?: number; bp_dia?: number; sugar?: number; sugar_context?: string; pulse?: number; spo2?: number; temp?: number }
export interface Rx {
  status: 'pending' | 'clear' | 'doctor_ok' | 'doctor_no'; has_image: boolean; checks: boolean[]
  doctor_name: string | null; doctor_note: string | null; uploaded_by: string | null; uploaded_at: string | null; decided_at: string | null
}
export interface Booking {
  id: string; ref: string; status: Status; mode: 'now' | 'scheduled'; scheduled_at: string; created_at: string
  assigned_at: string | null; accepted_at: string | null; arrived_at: string | null; started_at: string | null
  completed_at: string | null; cancelled_at: string | null; cancel_reason: string | null
  patient: { name: string; age: number; gender: string | null; relation: string | null; notes: string | null }
  address: { label: string | null; line1: string; line2: string | null; sector: number | null; landmark: string | null; lat: number | null; lng: number | null }
  sector: number | null; lat: number | null; lng: number | null; contact_phone: string
  services: { code: string; name: string; price: number; minutes: number; icon: string; needs_rx: boolean }[]
  total: number; needs_rx: boolean; injection_skipped: boolean
  pay_method: 'now' | 'after'; pay_status: 'unpaid' | 'claimed' | 'paid'; pay_ref: string | null; paid_via: string | null
  vitals: Vitals | null; procedure_note: string | null; consumables: string | null; nurse_notes: string | null
  rating: number | null; rating_tags: string[] | null; rating_comment: string | null
  nurse: NursePublic | null; rx: Rx | null
  customer?: { name: string; phone: string } | null
  incentive?: number
  nurse_name?: string | null; nurse_id?: string | null
}
export interface Availability {
  in_area: boolean; now_ok: boolean; eta_min: number | null; on_duty: number
  nurse: { first_name: string; qualification: string | null; verified: boolean; km: number | null } | null
  slots: string[]
}
