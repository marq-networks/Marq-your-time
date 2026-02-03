'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import '../../login/styles.css'

export default function VerifyMfaPage() {
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!code.trim()) { setError('Enter the verification code'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/security/mfa/verify', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ code, trust_device: trust }) })
      if (!res.ok) { setError('Invalid code'); return }
      window.location.href = '/'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-center">
        <motion.div 
          className="login-card" 
          aria-label="MFA Verification"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <GlassCard>
            <div className="login-header">
              <motion.div 
                className="login-logo" 
                aria-hidden="true"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)' }}
              >
                <ShieldCheck color="white" size={32} />
              </motion.div>
              <div className="text-center">
                <div className="login-brand" style={{fontSize:24}}>Security Check</div>
                <div className="login-tagline">Enter the code from your authenticator app</div>
              </div>
            </div>
            
            <form onSubmit={submit} className="login-form">
              <div className="field">
                <label className="label">Verification Code</label>
                <div className="input-wrapper">
                  <ShieldCheck className="input-icon" size={18} />
                  <input
                    type="text"
                    className="login-input login-input-with-icon"
                    placeholder="123456"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="row between" style={{marginTop:16, marginBottom:24}}>
                <label className="remember">
                  <input 
                    type="checkbox" 
                    className="toggle" 
                    checked={trust} 
                    onChange={e => setTrust(e.target.checked)} 
                  />
                  <span>Trust this device for 30 days</span>
                </label>
              </div>

              {error && <div className="field-error" style={{color:'#f87171', marginBottom:16, textAlign:'center'}}>{error}</div>}

              <div className="row">
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
                  {loading ? 'Verifying...' : (
                    <>
                      Verify <ArrowRight size={18} style={{marginLeft:8}} />
                    </>
                  )}
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
