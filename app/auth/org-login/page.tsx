'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Lock, ArrowRight } from 'lucide-react'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import AuthTabs from '../components/AuthTabs'
import Toast from '@components/Toast'
import '../login/styles.css'

export default function OrgLoginPage() {
  const [orgName, setOrgName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const submit = async () => {
    if (loading) return
    if (!orgName) { setToast({ m:'Enter organization name', t:'error' }); return }
    setLoading(true)
    const r = await fetch('/api/auth/org-login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ org_name: orgName, org_password: password }) })
    const d = await r.json()
    if (!r.ok) { setToast({ m: d.error || 'Login failed', t:'error' }); setLoading(false); return }
    window.location.href = '/'
  }

  return (
    <div className="login-root">
      <div className="login-center">
        <motion.div 
          className="login-card" 
          aria-label="Organization Login"
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
              >
                <Building2 color="white" size={32} />
              </motion.div>
              <div className="text-center">
                <div className="login-brand">MARQ</div>
                <div className="login-tagline">Organization Sign In</div>
              </div>
            </div>
            
            <AuthTabs />
            
            <div className="field">
              <label className="label">Organization Name</label>
              <div className="input-wrapper">
                <Building2 className="input-icon" size={18} />
                <input 
                  className="login-input login-input-with-icon" 
                  value={orgName} 
                  onChange={e=>setOrgName(e.target.value)} 
                  placeholder="Your org name" 
                />
              </div>
            </div>
            
            <div className="field">
              <label className="label">Org Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input 
                  className="login-input login-input-with-icon" 
                  type="password" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            
            <div className="row" style={{marginTop:24}}>
              <GlassButton 
                variant="primary" 
                onClick={submit} 
                style={{ 
                  width: '100%', 
                  height: 48,
                  opacity: loading ? 0.7 : 1, 
                  pointerEvents: loading ? 'none' : 'auto',
                  justifyContent: 'center',
                  fontSize: 16
                }}
              >
                {loading ? 'Verifying…' : (
                  <>
                    Continue <ArrowRight size={18} style={{marginLeft:8}} />
                  </>
                )}
              </GlassButton>
            </div>
          </GlassCard>
          <div className="login-footer">
            <a href="/auth/login" className="login-link">Back to User Sign In</a>
          </div>
        </motion.div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
