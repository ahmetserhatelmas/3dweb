import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import {
  FilePlus, CheckCircle2, Eye, RefreshCw,
  ThumbsUp, ThumbsDown, Briefcase, ChevronRight, ChevronDown,
  Activity, TrendingUp, AlertCircle
} from 'lucide-react'

const ACTIVITY_CONFIG = {
  // Customer activity types
  project_created: {
    icon: FilePlus,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    label: () => 'Yeni proje oluşturuldu',
    detail: (a) => a.actor ? `Oluşturan: ${a.actor}` : null,
  },
  quotation_accepted: {
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    label: () => 'Teklif kabul edildi',
    detail: (a) => {
      const price = a.meta?.price ? ` — ${Number(a.meta.price).toLocaleString('tr-TR')}₺` : ''
      return a.actor ? `${a.actor}${price}` : price || null
    },
  },
  quote_submitted: {
    icon: TrendingUp,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    label: () => 'Yeni teklif gönderildi',
    detail: (a) => {
      const price = a.meta?.price ? ` — ${Number(a.meta.price).toLocaleString('tr-TR')}₺` : ''
      return a.actor ? `${a.actor}${price}` : price || null
    },
  },
  project_reviewing: {
    icon: Eye,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
    label: () => 'Proje incelemede',
    detail: (a) => {
      const parts = [a.actor, a.meta?.revision ? `Rev. ${a.meta.revision}` : null].filter(Boolean)
      return parts.length ? parts.join(' — ') : null
    },
  },
  project_completed: {
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.15)',
    label: () => 'Proje tamamlandı',
    detail: (a) => a.actor || null,
  },
  revision_requested: {
    icon: RefreshCw,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    label: () => 'Revizyon talebi',
    detail: (a) => {
      const typeMap = { geometry: 'Geometri', quantity: 'Miktar', both: 'Geometri & Miktar' }
      const t = typeMap[a.meta?.revision_type] || a.meta?.revision_type || ''
      const parts = [a.actor, t].filter(Boolean)
      return parts.length ? parts.join(' — ') : null
    },
  },
  // Supplier activity types
  job_assigned: {
    icon: Briefcase,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    label: () => 'Yeni iş atandı',
    detail: (a) => {
      const ddl = a.meta?.deadline
        ? `Termin: ${new Date(a.meta.deadline).toLocaleDateString('tr-TR')}`
        : ''
      const parts = [a.actor, ddl].filter(Boolean)
      return parts.length ? parts.join(' — ') : null
    },
  },
  my_quote_accepted: {
    icon: ThumbsUp,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    label: () => 'Teklifiniz kabul edildi',
    detail: (a) => {
      const price = a.meta?.price ? ` — ${Number(a.meta.price).toLocaleString('tr-TR')}₺` : ''
      return a.actor ? `${a.actor}${price}` : price || null
    },
  },
  my_quote_rejected: {
    icon: ThumbsDown,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    label: () => 'Teklifiniz reddedildi',
    detail: (a) => a.actor || null,
  },
  job_completed: {
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.15)',
    label: () => 'İş tamamlandı',
    detail: (a) => a.actor || null,
  },
  revision_on_my_job: {
    icon: AlertCircle,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    label: () => 'Revizyon talebi alındı',
    detail: (a) => {
      const typeMap = { geometry: 'Geometri', quantity: 'Miktar', both: 'Geometri & Miktar' }
      const t = typeMap[a.meta?.revision_type] || a.meta?.revision_type || ''
      const parts = [a.actor, t].filter(Boolean)
      return parts.length ? parts.join(' — ') : null
    },
  },
}

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'Az önce'
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} gün önce`
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function RecentActivities() {
  const { token } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/projects/recent-activities?limit=15`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Aktiviteler yüklenemedi')
      const data = await res.json()
      setActivities(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recent-activities-card">
      <div className="ra-header" style={{ marginBottom: collapsed ? 0 : undefined }}>
        <button
          className="ra-title-wrap ra-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
        >
          <Activity size={18} className="ra-title-icon" />
          <h2 className="ra-title">Son Aktiviteler</h2>
          <ChevronDown
            size={16}
            className={`ra-chevron ${collapsed ? 'ra-chevron-collapsed' : ''}`}
          />
        </button>
        <button
          className="ra-refresh-btn"
          onClick={fetchActivities}
          disabled={loading}
          title="Yenile"
        >
          <RefreshCw size={15} className={loading ? 'ra-spinning' : ''} />
        </button>
      </div>

      {!collapsed && (
        loading ? (
          <div className="ra-skeleton-list">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="ra-skeleton-item">
                <div className="ra-skeleton-icon" />
                <div className="ra-skeleton-body">
                  <div className="ra-skeleton-line short" />
                  <div className="ra-skeleton-line long" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ra-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="ra-empty">
            <Activity size={32} className="ra-empty-icon" />
            <p>Henüz aktivite yok</p>
          </div>
        ) : (
          <ul className="ra-list">
            {activities.map((activity, idx) => {
              const cfg = ACTIVITY_CONFIG[activity.type]
              if (!cfg) return null
              const Icon = cfg.icon
              const detail = cfg.detail(activity)

              return (
                <li key={`${activity.type}-${activity.project_id}-${idx}`} className="ra-item">
                  <Link to={`/project/${activity.project_id}`} className="ra-item-link">
                    <div
                      className="ra-icon-wrap"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="ra-item-body">
                      <span className="ra-item-label">{cfg.label(activity)}</span>
                      <span className="ra-item-project">{activity.project_name}</span>
                      {detail && <span className="ra-item-detail">{detail}</span>}
                    </div>
                    <div className="ra-item-right">
                      <span className="ra-item-time">{timeAgo(activity.timestamp)}</span>
                      <ChevronRight size={14} className="ra-item-arrow" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      )}
    </div>
  )
}
