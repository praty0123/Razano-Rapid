import { BackHeader } from '../components/AppShell'
import { RAZANO_WHATSAPP } from '../lib/config'

export default function Privacy() {
  const h = 'font-headline-sm text-headline-sm text-on-surface mt-4'
  const p = 'font-body-md text-body-md text-on-surface-variant mt-1'
  return (
    <>
      <BackHeader title="Terms & Privacy" />
      <main className="pt-20 pb-12 px-margin-mobile max-w-[560px] mx-auto">
        <p className="font-label-sm text-label-sm text-outline uppercase">Razano Rapid • Sevora Care Private Limited • CIN U86201HR2026PTC143349</p>

        <h2 className={h}>What we do</h2>
        <p className={p}>Razano Rapid sends a registered nurse to your home in Gurgaon Sectors 47–57 for simple nursing procedures: vitals checks, injections and insulin given as per your doctor's prescription, dressings, catheter care, stitch removal and similar. We aim to reach in about 20 minutes, but times depend on traffic and nurse availability and are not guaranteed.</p>

        <h2 className={h}>What we don't do</h2>
        <p className={p}>We are not an emergency or ambulance service. In an emergency call 112. We do not sell or carry medicines; your family provides medicines prescribed by your doctor. We do not give IV drips or insert cannulas at home. Our nurse will not give an injection if the prescription can't be verified, and may ask a doctor before going ahead.</p>

        <h2 className={h}>Bookings, payment & cancellation</h2>
        <p className={p}>Prices are shown before you book and include the sterile consumables kit. You can pay by UPI or cash after the visit, or by UPI when booking. You can cancel free of charge until the nurse arrives. If you paid in advance and cancel, we refund to the same UPI account within 5 working days.</p>

        <h2 className={h}>Your data</h2>
        <p className={p}>We collect your name and mobile number, the patient's name, age, gender and medical notes, the visit address and map location, prescription photos, and the vitals and notes recorded by the nurse. We use this only to deliver the visit, keep a clinical record for you, contact you about your visit, and meet legal obligations. The assigned nurse sees what is needed for the visit. While a nurse is on the way, their live location is shown to you.</p>
        <p className={p}>We do not sell your data. Data is stored on secure cloud servers (Supabase). You can ask us to correct or delete your data, or withdraw consent, by messaging us on WhatsApp; some records may be kept where the law requires. We follow India's Digital Personal Data Protection Act, 2023.</p>

        <h2 className={h}>Contact / grievance</h2>
        <p className={p}>WhatsApp: +91 {RAZANO_WHATSAPP.slice(2, 7)} {RAZANO_WHATSAPP.slice(7)} • Email: pratyaksh@razano.in • Sevora Care Pvt Ltd, Sector 50, Gurugram, Haryana.</p>
        <p className="font-body-sm text-body-sm text-outline mt-6">Last updated: October 2026</p>
      </main>
    </>
  )
}
