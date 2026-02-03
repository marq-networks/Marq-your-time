'use client'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import GlassCard from '@components/ui/GlassCard'
import AuthTabs from '../components/AuthTabs'
import LoginForm from '../login/components/LoginForm'
import '../login/styles.css'

export default function Page() {
  return (
    <div className="login-root">
      <div className="login-center">
        <motion.div 
          className="login-card" 
          aria-label="Super Admin Login"
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
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', boxShadow: '0 0 40px rgba(236, 72, 153, 0.4)' }}
              >
                <Crown color="white" size={32} />
              </motion.div>
              <div className="text-center">
                <div className="login-brand">MARQ</div>
                <div className="login-tagline">Super Admin Access</div>
              </div>
            </div>
            
            <AuthTabs />
            <LoginForm />
          </GlassCard>
          <div className="login-footer">
            <a href="/auth/login" className="login-link">Back to standard login</a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
