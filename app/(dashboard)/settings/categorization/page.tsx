'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import Toast from '@components/Toast'
import TagPill from '@components/ui/TagPill'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { UrlCategory } from '@lib/categorization'

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

  return (
    <AppShell title="Categorization Settings">
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <GlassCard title="Overview">
          <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'stretch'}}>
            <div className="glass-panel subtle" style={{flex:'1 1 160px',padding:12,borderRadius:'var(--radius-large)',display:'flex',flexDirection:'column',gap:4}}>
              <span className="label" style={{opacity:0.8}}>Total categories</span>
              <span className="title" style={{fontSize:24}}>{totalRules}</span>
              <span className="subtitle" style={{opacity:0.7,fontSize:12}}>Mapped to productivity for this organization</span>
            </div>
            <div className="glass-panel subtle" style={{flex:'1 1 160px',padding:12,borderRadius:'var(--radius-large)',display:'flex',flexDirection:'column',gap:4}}>
              <span className="label" style={{opacity:0.8}}>Productive vs unproductive</span>
              <div style={{display:'flex',gap:12,alignItems:'baseline'}}>
                <span style={{color:'#22c55e',fontWeight:600}}>{productiveCount}</span>
                <span style={{opacity:0.5}}>/</span>
                <span style={{color:'#fb7185',fontWeight:600}}>{unproductiveCount}</span>
              </div>
              <span className="subtitle" style={{opacity:0.7,fontSize:12}}>How activity minutes will be classified</span>
            </div>
            <div className="glass-panel subtle" style={{flex:'1 1 160px',padding:12,borderRadius:'var(--radius-large)',display:'flex',flexDirection:'column',gap:4}}>
              <span className="label" style={{opacity:0.8}}>URL overrides</span>
              <span className="title" style={{fontSize:24}}>{totalOverrides}</span>
              <span className="subtitle" style={{opacity:0.7,fontSize:12}}>Custom rules for specific sites and paths</span>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-2" style={{alignItems:'start',gap:16}}>
          <GlassCard title="Productivity Rules">
            <div style={{marginBottom:12,opacity:0.8,fontSize:13}}>
              Choose how each category should impact productivity reports. Changes apply to all members in this organization.
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{width:160}}>Status</th>
                    <th style={{width:80,textAlign:'right'}}>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_CATEGORIES.map(cat => {
                    const value = getProductivity(cat)
                    const tone = value === 'productive' ? 'accent' : value === 'unproductive' ? 'danger' : 'muted'
                    return (
                      <tr key={cat}>
                        <td>
                          <div style={{display:'flex',flexDirection:'column',gap:2}}>
                            <span style={{fontWeight:500}}>{cat}</span>
                            <span style={{opacity:0.6,fontSize:11}}>Used for apps and URLs categorized as {cat}</span>
                          </div>
                        </td>
                        <td>
                          <GlassSelect 
                            value={value} 
                            onChange={(e: any) => updateRule(cat, e.target.value)}
                            style={{minWidth:140}}
                          >
                            <option value="productive">Productive</option>
                            <option value="neutral">Neutral</option>
                            <option value="unproductive">Unproductive</option>
                          </GlassSelect>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <TagPill tone={tone as any}>{value.charAt(0).toUpperCase() + value.slice(1)}</TagPill>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard title="URL Overrides" right={<ExportMenu onExport={handleExportOverrides} isExporting={isExportingOverrides} />}>
            <div style={{marginBottom:12,opacity:0.8,fontSize:13}}>
              Add rules for specific domains or paths to fine-tune how work and distractions are recognized.
            </div>
            <div className="row" style={{gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <input 
                className="input" 
                placeholder="e.g. linkedin.com, github.com/my-org, youtube.com/channel/123" 
                value={newUrl} 
                onChange={e => setNewUrl(e.target.value)} 
                style={{flex:'2 1 220px'}}
              />
              <GlassSelect value={newCategory} onChange={(e: any) => setNewCategory(e.target.value)} style={{flex:'1 1 160px'}}>
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </GlassSelect>
              <GlassButton variant="primary" onClick={addOverride} style={{flex:'0 0 auto'}}>
                Add override
              </GlassButton>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Category</th>
                    <th style={{width:120,textAlign:'right'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{textAlign:'center',opacity:0.5,padding:'16px 0'}}>
                        No overrides yet. Add one to treat a site differently for your team.
                      </td>
                    </tr>
                  )}
                  {overrides.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{display:'flex',flexDirection:'column',gap:2}}>
                          <span style={{fontWeight:500}}>{o.urlPattern}</span>
                          <span style={{opacity:0.6,fontSize:11}}>Matches any URL containing this pattern</span>
                        </div>
                      </td>
                      <td>
                        <TagPill tone="muted">{o.categoryKey}</TagPill>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <GlassButton
                          variant="secondary"
                          onClick={() => deleteOverride(o.id)}
                          style={{background:'#fb7185',borderColor:'#fb7185',fontSize:12,padding:'4px 10px'}}
                        >
                          Delete
                        </GlassButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
