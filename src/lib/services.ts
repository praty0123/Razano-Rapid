import type { Service } from './types'

/** Fallback catalogue (the live one comes from Supabase rr_services). */
export const FALLBACK_SERVICES: Service[] = [
  { code: 'vitals', name: 'Vitals Complete Check', description: 'BP, blood sugar (glucometer) & SpO2 check with digital log', price: 199, minutes: 15, icon: 'vital_signs', needs_rx: false, popular: true },
  { code: 'nebulisation', name: 'Nebulisation Session', description: 'Nebuliser setup with sterile sealed mask; family provides prescribed medicine', price: 199, minutes: 20, icon: 'air', needs_rx: false, popular: false },
  { code: 'injection', name: 'Injection Administration', description: 'IM / subcutaneous injection with sterile syringe, swab & safe disposal', price: 249, minutes: 15, icon: 'vaccines', needs_rx: true, popular: false },
  { code: 'insulin', name: 'Insulin Dose + Sugar Log', description: 'Insulin as prescribed, with glucometer reading logged', price: 249, minutes: 15, icon: 'bloodtype', needs_rx: true, popular: false },
  { code: 'dressing', name: 'Simple Sterile Dressing', description: 'Minor cuts, stage-1 bedsores, sterile gauze dressing', price: 299, minutes: 25, icon: 'healing', needs_rx: false, popular: false },
  { code: 'pillbox', name: 'Pill-box Setup / Training', description: '7-day medicine box organisation or insulin pen training for family', price: 299, minutes: 30, icon: 'medication', needs_rx: false, popular: false },
  { code: 'wound', name: 'Post-Op / Diabetic Foot Dressing', description: 'Post-op, bedsore or diabetic-foot wound cleaning & sterile dressing', price: 399, minutes: 35, icon: 'footprint', needs_rx: false, popular: false },
  { code: 'catheter', name: 'Catheter / Colostomy Bag Care', description: 'Catheter care, bag change, aseptic cleaning & stoma hygiene', price: 399, minutes: 30, icon: 'water_damage', needs_rx: false, popular: false },
  { code: 'sutures', name: 'Stitch or Staple Removal', description: 'Sterile stitch / staple removal as advised by your doctor, with wound check', price: 449, minutes: 25, icon: 'content_cut', needs_rx: false, popular: false },
  { code: 'discharge', name: 'Discharge Visit', description: 'First home visit after hospital discharge: vitals, wound check, medicines sorted', price: 499, minutes: 45, icon: 'home_health', needs_rx: false, popular: false },
]

export const HERO_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBKCMdr1oq8xQnLn2eRBBPity5vT6VzPwlYuYtxPYxn2KsNS1J-NCfuRX_4Zxo60AVEacnKTWxYrFbOpjERyrUwlPpFKccykKs3mk6_gcvcHrigwZPRBX1XABoCOHF04AaWLEEABPsc0iXf6jVyhSqhhYPnCcAIAA5nrRVIkx3CQ9Oz5zuZ8AIuYSoPz6sKu6eO7Uhcq-7uSFmUaz9GSRkcOdxHiuKBQYw1_q0lr8'
