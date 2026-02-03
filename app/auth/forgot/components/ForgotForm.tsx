'use client'
import { useState } from 'react'
import { Mail, ArrowRight } from 'lucide-react'
import GlassButton from '@components/ui/GlassButton'
import Toast from '@components/Toast'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorEmail, setErrorEmail] = useState<string | undefined>()
  const [toastMsg, setToastMsg] = useState<string | undefined>()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorEmail(undefined)
    if (!email) { setErrorEmail('Email is required'); return }
    setLoading(true)
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).catch(()=>{})
      setToastMsg('If the email exists, we sent reset instructions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
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
            aria-describedby={errorEmail ? 'forgot-email-error' : undefined}
          />
        </div>
        {errorEmail && <div id="forgot-email-error" className="field-error" style={{color:'#f87171', fontSize:12, marginTop:4}}>{errorEmail}</div>}
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
          {loading ? 'Sending...' : (
            <>
              Send Reset Link <ArrowRight size={18} style={{marginLeft:8}} />
            </>
          )}
        </GlassButton>
      </div>
      <Toast message={toastMsg} type="success" />
    </form>
  )
}

