'use client'
import GlassCard from '@components/ui/GlassCard'
import ForgotForm from './components/ForgotForm'
import './styles.css'

export default function Page() {
  return (
    <div className="forgot-root">
      <div className="forgot-center">
        <div className="forgot-card" aria-label="Forgot Password">
          <GlassCard>
            <div className="forgot-header">
              <div className="forgot-logo" aria-hidden="true" />
              <div className="forgot-title">Reset your password</div>
              <div className="forgot-sub">Enter your email to receive reset instructions</div>
            </div>
            <ForgotForm />
          </GlassCard>
          <div className="forgot-footer">
            <a href="/auth/login" className="forgot-link">Back to Sign In</a>
          </div>
        </div>
      </div>
    </div>
  )
}

