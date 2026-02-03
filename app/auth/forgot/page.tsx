'use client'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import GlassCard from '@components/ui/GlassCard'
import ForgotForm from './components/ForgotForm'
import '../login/styles.css'

export default function Page() {
  return (
    <div className="login-root">
      <div className="login-center">
        <motion.div 
          className="login-card" 
          aria-label="Forgot Password"
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
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 0 40px rgba(245, 158, 11, 0.4)' }}
              >
                <KeyRound color="white" size={32} />
              </motion.div>
              <div className="text-center">
                <div className="login-brand" style={{fontSize:24}}>Reset Password</div>
                <div className="login-tagline">Enter your email to receive instructions</div>
              </div>
            </div>
            <ForgotForm />
          </GlassCard>
          <div className="login-footer">
            <a href="/auth/login" className="login-link">Back to Sign In</a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

