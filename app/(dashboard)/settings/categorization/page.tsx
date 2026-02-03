'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassTable from '@components/ui/GlassTable'
import GlassInput from '@components/ui/GlassInput'
import Toast from '@components/Toast'
import TagPill from '@components/ui/TagPill'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { UrlCategory } from '@lib/categorization'
import { PieChart, Globe, Shield, Filter, Plus, Trash2, Layout, Info } from 'lucide-react'

const DEFAULT_CATEGORIES: UrlCategory[] = [
  'Work-related', 'Development', 'Communication', 'Search Engine',
  'Social Media', 'News & Media', 'Entertainment', 'E-commerce', 'Adult Content', 'Uncategorized'
]

export default function CategorizationSettings() {
  const [orgId, setOrgId] = useState('')
  const [rules, setRules] = useState<any[]>([])
  const [overrides, setOverrides] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  
  // Export State
  const [isExportingRules, setIsExportingRules] = useState(false)
  const [isExportingOverrides, setIsExportingOverrides] = useState(false)

  // New Override Form
  const [newUrl, setNewUrl] = useState('')
  const [newCategory, setNewCategory] = useState<string>('Work-related')

  useEffect(() => {
    const oid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
    setOrgId(oid)
  }, [])

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  const load = async () => {
    setLoading(true)
    try {
      const [rRes, oRes] = await Promise.all([
        fetch(`/api/settings/categorization/rules?orgId=${orgId}`),
        fetch(`/api/settings/categorization/overrides?orgId=${orgId}`)
      ])
      const rData = await rRes.json()
      const oData = await oRes.json()
      setRules(rData.items || [])
      setOverrides(oData.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const getProductivity = (cat: string) => {
    const r = rules.find(x => x.categoryKey === cat)
    if (r) return r.productivityStatus
    // Defaults
    if (['Work-related', 'Development', 'Communication', 'Search Engine'].includes(cat)) return 'productive'
    if (['Social Media', 'Entertainment', 'Adult Content', 'E-commerce'].includes(cat)) return 'unproductive'
    return 'neutral'
  }

  const updateRule = async (cat: string, status: string) => {
    const res = await fetch('/api/settings/categorization/rules', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ orgId, categoryKey: cat, productivityStatus: status })
    })
    if (res.ok) {
      setToast({ m: 'Rule updated', t: 'success' })
      load()
    } else {
      setToast({ m: 'Failed to update rule', t: 'error' })
    }
  }

  const handleExportOverrides = async (type: 'csv' | 'pdf') => {
    setIsExportingOverrides(true)
    try {
      const exportItems = overrides.map(o => ({
        url: o.urlPattern,
        category: o.categoryKey,
        created: new Date(o.createdAt).toLocaleString()
      }))
      const exportColumns: ExportColumn[] = [
        { header: 'URL Pattern', accessor: 'url' },
        { header: 'Category', accessor: 'category' },
        { header: 'Created', accessor: 'created' },
      ]
      const filename = `url_overrides_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, exportColumns, filename)
      else await exportToPdf(exportItems, exportColumns, 'URL Overrides', filename)
    } catch (e) {
      console.error(e)
      setToast({ m: 'Export failed', t: 'error' })
    } finally {
      setIsExportingOverrides(false)
    }
  }

  const addOverride = async () => {
    if (!newUrl) return
    const res = await fetch('/api/settings/categorization/overrides', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ orgId, urlPattern: newUrl, categoryKey: newCategory })
    })
    if (res.ok) {
      setToast({ m: 'Override added', t: 'success' })
      setNewUrl('')
      load()
    } else {
      setToast({ m: 'Failed to add override', t: 'error' })
    }
  }

  const deleteOverride = async (id: string) => {
    if (!confirm('Are you sure?')) return
    const res = await fetch(`/api/settings/categorization/overrides?orgId=${orgId}&id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setToast({ m: 'Override deleted', t: 'success' })
      load()
    } else {
      setToast({ m: 'Failed to delete', t: 'error' })
    }
  }

  const totalRules = DEFAULT_CATEGORIES.length
  const totalOverrides = overrides.length
  const productiveCount = DEFAULT_CATEGORIES.filter(c => getProductivity(c) === 'productive').length
  const unproductiveCount = DEFAULT_CATEGORIES.filter(c => getProductivity(c) === 'unproductive').length

  const ruleHeaders = [
    { name: 'Category', width: '40%' },
    { name: 'Status', width: '30%' },
    { name: 'Impact', width: '30%', align: 'right' as const }
  ]

  const ruleRows = DEFAULT_CATEGORIES.map(cat => {
    const value = getProductivity(cat)
    const tone = value === 'productive' ? 'accent' : value === 'unproductive' ? 'danger' : 'muted'
    return [
      <div key="cat" className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${value === 'productive' ? 'bg-emerald-50 text-emerald-600' : value === 'unproductive' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
          {value === 'productive' ? <Shield size={16} /> : value === 'unproductive' ? <PieChart size={16} /> : <Filter size={16} />}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-700">{cat}</span>
          <span className="text-xs text-slate-400">Default category</span>
        </div>
      </div>,
      <GlassSelect 
        key="select"
        value={value} 
        onChange={(e: any) => updateRule(cat, e.target.value)}
        className="w-full max-w-[160px]"
      >
        <option value="productive">Productive</option>
        <option value="neutral">Neutral</option>
        <option value="unproductive">Unproductive</option>
      </GlassSelect>,
      <div key="tag" className="flex justify-end">
        <TagPill tone={tone as any}>{value.charAt(0).toUpperCase() + value.slice(1)}</TagPill>
      </div>
    ]
  })

  const overrideHeaders = [
    { name: 'Pattern', width: '40%' },
    { name: 'Category', width: '40%' },
    { name: 'Actions', width: '20%', align: 'right' as const }
  ]

  const overrideRows = overrides.map(o => [
    <div key="pat" className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
        <Globe size={16} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-slate-700">{o.urlPattern}</span>
        <span className="text-xs text-slate-400">Custom rule</span>
      </div>
    </div>,
    <div key="cat" className="flex items-center gap-2">
      <TagPill tone="muted">{o.categoryKey}</TagPill>
    </div>,
    <div key="act" className="flex justify-end">
      <GlassButton
        variant="ghost"
        size="sm"
        onClick={() => deleteOverride(o.id)}
        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0 flex items-center justify-center rounded-lg transition-colors"
      >
        <Trash2 size={14}/>
      </GlassButton>
    </div>
  ])

  if (overrides.length === 0) {
    // We'll handle empty state in the render
  }

  return (
    <AppShell title="Categorization Rules">
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Intro */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="text-indigo-600" size={24} />
              Productivity Intelligence
            </h2>
            <p className="text-slate-500 text-sm mt-1">Configure how we classify apps and websites to calculate productivity scores.</p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton 
               onClick={() => { if(orgId) load() }}
               className="bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            >
              Refresh
            </GlassButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules Section */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard 
              className="relative overflow-hidden"
              title={
                <div className="relative z-10 flex items-center gap-2">
                  <PieChart className="text-indigo-500" size={20} />
                  <span className="text-lg font-semibold text-slate-800">Global Category Rules</span>
                </div>
              }
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <PieChart size={120} className="text-indigo-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm text-slate-500 mb-6">
                  Define the default productivity status for broad categories. These rules apply unless a specific URL override exists.
                </p>
                <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-white/50 backdrop-blur-sm">
                  <GlassTable columns={ruleHeaders} rows={ruleRows} />
                </div>
              </div>
            </GlassCard>

            <GlassCard 
              className="relative overflow-hidden"
              title={
                <div className="relative z-10 flex items-center gap-2">
                  <Globe className="text-emerald-500" size={20} />
                  <span className="text-lg font-semibold text-slate-800">URL Overrides</span>
                </div>
              }
              right={
                <div className="relative z-10">
                   <ExportMenu onExport={handleExportOverrides} isExporting={isExportingOverrides} />
                </div>
              }
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Globe size={120} className="text-emerald-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm text-slate-500 mb-6">
                  Specific URLs that deviate from the global category rules.
                </p>
                {overrides.length > 0 ? (
                  <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-white/50 backdrop-blur-sm">
                    <GlassTable columns={overrideHeaders} rows={overrideRows} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Globe size={48} className="text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No overrides defined</h3>
                    <p className="text-slate-500 text-sm mt-1">Add a specific URL pattern below to customize its category.</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Sidebar / Add Form */}
          <div className="space-y-6">
             <GlassCard className="relative overflow-hidden sticky top-6">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Filter size={80} className="text-indigo-500" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <Plus size={20} />
                    </div>
                    <h3 className="font-semibold text-slate-800">Add New Override</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">URL Pattern</label>
                      <GlassInput 
                        placeholder="e.g. facebook.com" 
                        value={newUrl}
                        onChange={(e:any) => setNewUrl(e.target.value)}
                        className="bg-white"
                      />
                      <p className="text-[10px] text-slate-400">Can be a domain or partial URL.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                      <GlassSelect 
                        value={newCategory} 
                        onChange={(e:any) => setNewCategory(e.target.value)}
                        className="w-full bg-white"
                      >
                        {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </GlassSelect>
                    </div>

                    <GlassButton 
                      onClick={addOverride}
                      disabled={!newUrl}
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                    >
                      Add Override
                    </GlassButton>
                  </div>
                </div>
             </GlassCard>

             <GlassCard className="bg-slate-50 border-slate-200/60">
                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Info size={16} className="text-slate-400"/> 
                  How it works
                </h3>
                <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
                  <li>Global rules apply to all URLs unless overridden.</li>
                  <li>Overrides take precedence over global rules.</li>
                  <li>Productivity scores are calculated based on time spent in "Productive" vs "Unproductive" apps/sites.</li>
                </ul>
             </GlassCard>
          </div>
        </div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
