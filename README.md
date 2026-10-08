# Razano Rapid: razanorapid.in

A mobile web app where families book a nurse, track the nurse live, and pay. Nurses receive and complete visits in **Nurse Mode**, and you manage everything at **/admin**.

**Stack:** React + Vite + Tailwind v4 + react-router v7 (the same as razano.in), with the backend on Supabase project `jboqafespcbpwxcetgqy`.

---

## 1. Backend setup (Supabase, about 5 minutes)

1. Open Supabase and go to **SQL Editor → New query**.
2. Paste the whole of `supabase/razanorapid-setup.sql` and click **Run**. The file is safe to run again later.
3. Make yourself admin:
   - Open the app and sign up with **9953456837**.
   - Then run this in the SQL Editor:
     ```sql
     update public.rr_users set role = 'admin' where phone = '9953456837';
     ```
4. Copy your anon key from **Project Settings → API → `anon` `public`**.

This creates new `rr_*` tables only. Your razano.in data and the old `rapid_*` HTML app are not touched.

## 2. Run on your Mac (VS Code)

```bash
cd razano-rapid
npm install
cp .env.example .env      # then paste your anon key into .env
npm run dev               # opens http://localhost:5173
```

To test it on your phone, run `npm run dev -- --host` and open the "Network" URL it prints.

## 3. Deploy (GitHub → Vercel)

1. Create a GitHub repo called `razano-rapid`, then push:
   ```bash
   git init && git add . && git commit -m "Razano Rapid v1"
   git branch -M main
   git remote add origin https://github.com/<you>/razano-rapid.git
   git push -u origin main
   ```
2. In Vercel, go to **Add New → Project** and import `razano-rapid`. Vercel detects Vite automatically.
3. Under **Environment Variables**, add every line from `.env.example`, with your real anon key. Then click **Deploy**.
4. Add your domain:
   - In Vercel, go to **Project → Settings → Domains** and add `razanorapid.in` and `www.razanorapid.in`.
   - At your domain registrar, set the DNS records Vercel shows you. Usually that's:
     - `A` record: `@` → `76.76.21.21`
     - `CNAME` record: `www` → `cname.vercel-dns.com`

     Alternatively, point the nameservers to Vercel, as you did for razano.in.

After this, every `git push` deploys automatically.

## 4. Go-live checklist

- [ ] **Add the nurse.** In `/admin → Nurses → Add nurse`, enter name, phone, password, GNM, registration number, bike and photo. Tick **Verified** only after the Haryana council registration and police check are done.
- [ ] **Set up the nurse's phone.** He logs in, opens **Nurse Mode**, and taps **On duty**. When the phone asks, he allows **location** and **notifications**, and keeps the app open (the screen stays on). On Android Chrome, use "Add to Home screen" so it works like an app.
- [ ] **Add the GP, once hired.** Set `VITE_GP_WHATSAPP` (format 91XXXXXXXXXX) and `VITE_GP_NAME` in Vercel, then redeploy. Until then, "Dosage clarification" goes to the Razano WhatsApp.
- [ ] **Add your logo and photo (optional).** Put `razano_logo.png` and `hero.jpg` in `/public`. Without them, the app uses the built-in "R" mark and the Stitch photo.
- [ ] **Run one test booking** end-to-end yourself before sharing the link.

## How it works

- **Booking:** the family picks procedures and the patient + address, then chooses **Now** or a **30-minute slot**. Bookings are only possible in Sectors 47–57; you can change this in table `rr_config`.
- **Assignment:** happens automatically.
  - "Now" visits go to the nearest free on-duty nurse.
  - Scheduled visits go to the nurse with the fewest visits in that slot.
  - If no nurse is on duty, the booking waits and goes to the first nurse who switches on duty.
  - You can reassign any visit from `/admin`.
- **Live tracking:** the nurse's phone shares GPS every ~20 seconds while on duty. The family sees the bike on the map with a live ETA.
- **Injection safety:** for injection and insulin visits, the "Begin procedure" step stays locked until one of these happens:
  - The nurse ticks all 5 prescription checks against a photo of the prescription.
  - The nurse records a doctor's OK.

  The server enforces this lock as well as the app.
- **Payments:** UPI to `pratyaksh200@okaxis` through the GPay/PhonePe/Paytm buttons or a QR code, or cash. The family taps "I've paid" with a reference number. The nurse or admin then marks the visit paid.
- **Records:** vitals, nurse notes, a printable PDF report, the summary on WhatsApp, and ratings.

## Prices and settings

- **Prices and services:** edit table `rr_services` in Supabase (Table Editor). The app shows the changes instantly.
- **Nurse incentive** (`nurse_incentive`) and **service sectors** (`service_sectors`): edit table `rr_config`.
