'use client'
import GlassCard from '@components/ui/GlassCard'
import LoginForm from './components/LoginForm'
import './styles.css'

export default function Page() {
  return (
    <div className="login-root">
      <div className="login-center">
        <div className="login-card" aria-label="Login">
          <GlassCard>
            <div className="login-header">
              <div className="login-logo" aria-hidden="true" />
              <div className="login-brand">MARQ</div>
              <div className="login-tagline">Smart Work. Real Results.</div>
            </div>
            <LoginForm />
          </GlassCard>
          <div className="login-footer">
            <span>Don’t have an account? </span>
            <a href="#" className="login-link">Contact Admin</a>
          </div>
        </div>
      </div>
    </div>
  )
}
