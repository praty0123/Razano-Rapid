import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useSession } from '../lib/session'
import { RAZANO_WHATSAPP } from '../lib/config'
import { waLink } from '../lib/format'
import { Field, Icon, PrimaryButton, Sheet } from './ui'

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, signup } = useSession()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = mode === 'signup' ? await signup(name, phone, pass) : await login(phone, pass)
      toast.success(`Welcome${mode === 'login' ? ' back' : ''}, ${u.name.split(' ')[0]}`)
      setPass('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally { setBusy(false) }
  }

  const tab = (m: typeof mode, label: string) => (
    <button type="button" onClick={() => setMode(m)}
      className={`py-2.5 px-3 rounded font-label-md text-label-md transition-all ${mode === m ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>
      {label}
    </button>
  )

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'signup' ? 'Create your account' : 'Log in'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-lg">
          {tab('signup', 'New here')}
          {tab('login', 'I have an account')}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {mode === 'signup'
            ? 'Book in under a minute. Your nurse and our team will call you on this number.'
            : 'Families, nurses and Razano team log in here.'}
        </p>
        {mode === 'signup' && (
          <Field label="Your name">
            <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rohit Sharma" autoComplete="name" required />
          </Field>
        )}
        <Field label={mode === 'signup' ? 'Mobile number' : 'Mobile number or email'}>
          <input className="field" value={phone} onChange={e => setPhone(e.target.value)}
            inputMode={mode === 'signup' ? 'tel' : 'email'} placeholder={mode === 'signup' ? '98XXXXXXXX' : '98XXXXXXXX'}
            autoComplete={mode === 'signup' ? 'tel' : 'username'} required />
        </Field>
        <Field label={mode === 'signup' ? 'Create a password (min 6 characters)' : 'Password'}>
          <div className="relative">
            <input className="field pr-12" type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required />
            <button type="button" aria-label="Show password" onClick={() => setShow(s => !s)} className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-outline">
              <Icon name={show ? 'visibility_off' : 'visibility'} className="text-[20px]" />
            </button>
          </div>
        </Field>
        <PrimaryButton type="submit" busy={busy}>
          <span>{mode === 'signup' ? 'Create account & continue' : 'Log in'}</span>
          <Icon name="arrow_forward" className="text-[18px]" />
        </PrimaryButton>
        {mode === 'signup' ? (
          <p className="font-body-sm text-body-sm text-outline text-center">
            By continuing you agree to our <Link to="/privacy" onClick={onClose} className="text-primary underline">Terms & Privacy Policy</Link>.
          </p>
        ) : (
          <a className="font-label-md text-label-md text-primary text-center" target="_blank" rel="noreferrer"
            href={waLink(RAZANO_WHATSAPP, 'Hi, I forgot my Razano Rapid password. My registered number is: ')}>
            Forgot password? WhatsApp us
          </a>
        )}
      </form>
    </Sheet>
  )
}
