'use client'
import { useState } from 'react'
import GlassInput from '@components/ui/GlassInput'
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
    <form onSubmit={onSubmit} className="forgot-form">
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
          aria-describedby={errorEmail ? 'forgot-email-error' : undefined}
        />
        {errorEmail && <div id="forgot-email-error" className="field-error">{errorEmail}</div>}
      </div>
      <GlassButton variant="primary" style={{ width: '100%' }}>
        {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
        {loading ? 'Sending…' : 'Send Reset Link'}
      </GlassButton>
      <Toast message={toastMsg} type="success" />
    </form>
  )
}

