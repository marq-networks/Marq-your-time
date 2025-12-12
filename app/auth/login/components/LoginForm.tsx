'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import GlassInput from '@components/ui/GlassInput'
import GlassButton from '@components/ui/GlassButton'
import Toast from '@components/Toast'

type LoginResponse = {
  mfaRequired?: boolean
  memberships?: { role: 'owner'|'admin'|'manager'|'member' }[]
  role?: 'owner'|'admin'|'manager'|'member'
}

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorEmail, setErrorEmail] = useState<string | undefined>()
  const [errorPassword, setErrorPassword] = useState<string | undefined>()
  const [toastMsg, setToastMsg] = useState<string | undefined>()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorEmail(undefined)
    setErrorPassword(undefined)
    if (!email) setErrorEmail('Email is required')
    if (!password) setErrorPassword('Password is required')
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember })
      })
      if (!res.ok) {
        setToastMsg('Incorrect email or password')
        setLoading(false)
        return
      }
      const data: LoginResponse & { org_login_required?: boolean } = await res.json()
      if (data.mfaRequired) {
        router.push('/auth/mfa/verify')
        return
      }
      if (data.org_login_required) {
        router.push('/auth/org-login')
        return
      }
      const memberships = Array.isArray(data.memberships) ? data.memberships : []
      if (memberships.length > 1) {
        router.push('/org/select')
        return
      }
      const role = memberships[0]?.role || data.role || 'member'
      try { document.cookie = `current_role=${role}; path=/; SameSite=Lax` } catch {}
      if (role === 'member') router.push('/my/time')
      else if (role === 'manager') router.push('/activity/overview')
      else router.push('/org/list')
    } catch (err) {
      setToastMsg('Incorrect email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form" aria-labelledby="login-title">
      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <GlassInput
          id="email"
          name="email"
          type="email"
          autoFocus
          placeholder="you@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-invalid={!!errorEmail}
          aria-describedby={errorEmail ? 'email-error' : undefined}
        />
        {errorEmail && <div id="email-error" className="field-error">{errorEmail}</div>}
      </div>

      <div className="field">
        <label htmlFor="password" className="label">Password</label>
        <div className="password-row">
          <GlassInput
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={!!errorPassword}
            aria-describedby={errorPassword ? 'password-error' : undefined}
          />
          <button type="button" className="eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        {errorPassword && <div id="password-error" className="field-error">{errorPassword}</div>}
      </div>

      {/* Organization login is a separate step now */}

      <div className="row between">
        <label className="remember">
          <input type="checkbox" className="toggle" checked={remember} onChange={e => setRemember(e.target.checked)} aria-label="Remember me" />
          <span>Remember me</span>
        </label>
        <a href="/auth/forgot" className="login-link">Forgot Password?</a>
      </div>

      <GlassButton variant="primary" style={{ width: '100%' }}>
        {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
        {loading ? 'Signing In…' : 'SIGN IN'}
      </GlassButton>

      <Toast message={toastMsg} type="error" />
    </form>
  )
}
