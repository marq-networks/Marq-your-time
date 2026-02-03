'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import GlassButton from '@components/ui/GlassButton'
import Toast from '@components/Toast'
import '../../login/styles.css'

type LoginResponse = {
  mfaRequired?: boolean
  memberships?: { role: 'owner'|'admin'|'manager'|'member'|'employee' }[]
  role?: 'owner'|'admin'|'manager'|'member'|'employee'
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
      
      // If the user is strictly an employee (member) in all organizations, redirect to My Day
      const isEmployeeOnly = memberships.length > 0 && memberships.every(m => m.role === 'member' || m.role === 'employee')
      if (isEmployeeOnly) {
        const role = memberships[0].role
        try { document.cookie = `current_role=${role}; path=/; SameSite=Lax` } catch {}
        router.push('/my/day')
        return
      }

      if (memberships.length > 1) {
        router.push('/org/select')
        return
      }
      const role = memberships[0]?.role || data.role || 'member'
      try { document.cookie = `current_role=${role}; path=/; SameSite=Lax` } catch {}

      if (['owner', 'admin', 'super_admin', 'manager'].includes(role)) {
        router.push('/team/dashboard')
        return
      }
      
      router.push('/')
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
        <div className="input-wrapper">
          <Mail className="input-icon" size={18} />
          <input
            id="email"
            name="email"
            type="email"
            autoFocus
            className="login-input login-input-with-icon"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            aria-invalid={!!errorEmail}
            aria-describedby={errorEmail ? 'email-error' : undefined}
          />
        </div>
        {errorEmail && <div id="email-error" className="field-error" style={{color:'#f87171', fontSize:12, marginTop:4}}>{errorEmail}</div>}
      </div>

      <div className="field">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <label htmlFor="password" className="label" style={{marginBottom:0}}>Password</label>
          <a href="/auth/forgot" className="forgot-link">Forgot?</a>
        </div>
        <div className="input-wrapper" style={{marginTop:8}}>
          <Lock className="input-icon" size={18} />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="login-input login-input-with-icon"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={!!errorPassword}
            aria-describedby={errorPassword ? 'password-error' : undefined}
          />
        </div>
        {errorPassword && <div id="password-error" className="field-error" style={{color:'#f87171', fontSize:12, marginTop:4}}>{errorPassword}</div>}
      </div>

      <div className="row" style={{marginTop:24}}>
        <GlassButton 
          variant="primary" 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            height: 48,
            opacity: loading ? 0.7 : 1, 
            pointerEvents: loading ? 'none' : 'auto',
            justifyContent: 'center',
            fontSize: 16
          }}
        >
          {loading ? 'Signing in...' : (
            <>
              Sign In <ArrowRight size={18} style={{marginLeft:8}} />
            </>
          )}
        </GlassButton>
      </div>

      <Toast message={toastMsg} type="error" />
    </form>
  )
}
