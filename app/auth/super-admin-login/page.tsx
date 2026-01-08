'use client'
import GlassCard from '@components/ui/GlassCard'
import AuthTabs from '../components/AuthTabs'
import LoginForm from '../login/components/LoginForm'
import '../login/styles.css'

export default function Page() {
  return (
    <div className="login-root">
      <div className="login-center">
        <div className="login-card" aria-label="Super Admin Login">
          <GlassCard>
            <div className="login-header">
              <div className="login-logo" aria-hidden="true" />
              <div className="login-brand">MARQ</div>
              <div className="login-tagline">Super Admin Access</div>
            </div>
            <AuthTabs />
            <LoginForm />
          </GlassCard>
          <div className="login-footer">
            <a href="/auth/login" className="login-link">Back to standard login</a>
          </div>
        </div>
      </div>
    </div>
  )
}
