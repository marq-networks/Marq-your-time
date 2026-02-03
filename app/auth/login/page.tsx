'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Building2, Users, Heart, ShieldCheck, ArrowRight } from 'lucide-react'
import GlassCard from '@components/ui/GlassCard'
import LoginForm from './components/LoginForm'
import './styles.css'
import Link from 'next/link'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin')

  return (
    <div className="login-root">
      <div className="portal-container">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="login-logo"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 0 40px rgba(239, 68, 68, 0.4)' }}
        >
          <Heart fill="white" color="white" size={32} />
        </motion.div>

        {/* Title */}
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="portal-title"
        >
          {activeTab === 'admin' ? 'Admin Portal' : 'Employee Portal'}
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="portal-subtitle"
        >
          Select your {activeTab === 'admin' ? 'administrative' : 'account'} role
        </motion.p>

        {/* Tabs */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="portal-tabs"
        >
          <button 
            className={`portal-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Portal
          </button>
          <button 
            className={`portal-tab ${activeTab === 'employee' ? 'active' : ''}`}
            onClick={() => setActiveTab('employee')}
          >
            Employee Portal
          </button>
        </motion.div>

        {/* Content */}
        <div style={{ width: '100%' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'admin' ? (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="role-grid"
              >
                <RoleCard 
                  icon={<Crown />}
                  title="Super Admin"
                  desc="Full platform access & system management"
                  href="/auth/super-admin-login"
                  color="pink"
                />
                <RoleCard 
                  icon={<Building2 />}
                  title="Organization Admin"
                  desc="Manage organization users & settings"
                  href="/auth/org-login"
                  color="blue"
                />
                <RoleCard 
                  icon={<Users />}
                  title="Team Admin"
                  desc="Manage team members & activities"
                  onClick={() => setActiveTab('employee')}
                  color="green"
                />
              </motion.div>
            ) : (
              <motion.div 
                key="employee"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ maxWidth: 440, margin: '0 auto' }}
              >
                <GlassCard>
                  <div style={{ marginBottom: 24, textAlign: 'center' }}>
                     <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#fff' }}>Welcome Back</h3>
                     <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Enter your credentials to access your account</p>
                  </div>
                  <LoginForm />
                </GlassCard>
                <div className="login-footer">
                  <span>Don’t have an account? </span>
                  <a href="#" className="login-link">Contact Admin</a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="portal-footer"
        >
          <ShieldCheck size={16} />
          <span>Protected by enterprise-grade security</span>
        </motion.div>
      </div>
    </div>
  )
}

function RoleCard({ icon, title, desc, href, color, onClick }: any) {
  const Content = (
    <>
      <div className="role-icon-wrapper">
        {icon}
      </div>
      <div className="role-info">
        <div className="role-title">{title}</div>
        <div className="role-desc">{desc}</div>
      </div>
      <ArrowRight size={20} className="role-arrow" />
    </>
  )

  if (href && !onClick) {
    return (
      <Link href={href} className={`role-card ${color}`}>
        {Content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={`role-card ${color}`} style={{ width: '100%', textAlign: 'left', border: 'none' }}>
      {Content}
    </button>
  )
}
