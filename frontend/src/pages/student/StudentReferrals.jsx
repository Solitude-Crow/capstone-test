// src/pages/student/StudentReferrals.jsx
// Student "My Referrals" — mirrors the My Appointments layout: status tabs,
// newest/oldest sort, search and pagination over the student's own referrals.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Users, Search, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import toast from 'react-hot-toast'

import { referralAPI } from '@/api'
import PageBanner   from '@/components/ui/PageBanner'
import FilterTabs   from '@/components/ui/FilterTabs'
import EmptyState   from '@/components/ui/EmptyState'
import ReferralCard from '@/components/ui/ReferralCard'
import Pagination   from '@/components/ui/Pagination'

const TAB_VALUES = ['all', 'pending', 'under_review', 'accepted', 'scheduled', 'completed', 'rejected']
const TAB_LABELS = {
  all: 'All', pending: 'Pending', under_review: 'Under Review',
  accepted: 'Accepted', scheduled: 'Scheduled', completed: 'Completed', rejected: 'Rejected',
}

export default function StudentReferrals() {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState('newest') // 'newest' | 'oldest'
  const [page, setPage]           = useState(1)
  const [limit, setLimit]         = useState(5)

  useEffect(() => {
    referralAPI.getAll({ limit: 100 })
      .then(({ data }) => setReferrals(data.referrals || []))
      .catch(() => toast.error('Failed to load referrals'))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() =>
    TAB_VALUES.reduce((acc, v) => {
      acc[v] = v === 'all' ? referrals.length : referrals.filter((r) => r.status === v).length
      return acc
    }, {}),
  [referrals])

  const tabs = useMemo(() =>
    TAB_VALUES.map((v) => ({ value: v, label: TAB_LABELS[v], count: counts[v] })),
  [counts])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const base = referrals.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!term) return true
      const haystack = [
        r.category,
        r.facultyId?.fullName,
        r.observationDetails,
        r.reason,
        ...(r.referralIndicators ?? []),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
    return [...base].sort((a, b) => {
      const diff = new Date(b.createdAt) - new Date(a.createdAt)
      return sort === 'newest' ? diff : -diff
    })
  }, [referrals, filter, search, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / limit))
  const safePage = Math.min(page, pages)
  const paged = filtered.slice((safePage - 1) * limit, safePage * limit)

  const changeFilter = useCallback((v) => { setFilter(v); setPage(1) }, [])
  const changeSearch = useCallback((e) => { setSearch(e.target.value); setPage(1) }, [])
  const changeLimit  = useCallback((n) => { setLimit(n); setPage(1) }, [])

  return (
    <>
      <PageBanner
        title="My Referrals"
        subtitle="Counseling referrals submitted for you by faculty members"
      />

      <div className="space-y-4">
        <FilterTabs tabs={tabs} active={filter} onChange={changeFilter} />

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by concern, faculty, or category…"
              value={search}
              onChange={changeSearch}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>
          <button
            type="button"
            onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white text-xs font-semibold text-slate-600 hover:border-primary-300 transition-colors shrink-0"
          >
            {sort === 'newest'
              ? <><ArrowDownWideNarrow size={14} /> Newest First</>
              : <><ArrowUpNarrowWide size={14} /> Oldest First</>}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        ) : paged.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No matching referrals' : filter === 'all' ? 'No referrals yet' : `No ${TAB_LABELS[filter].toLowerCase()} referrals`}
            description={
              search
                ? 'Try a different search term.'
                : 'When a faculty member refers you for counseling, it will appear here.'
            }
          />
        ) : (
          <div className="space-y-4">
            {paged.map((r) => (
              <ReferralCard key={r._id} referral={r} viewerRole="student" />
            ))}
          </div>
        )}

        {!loading && (
          <Pagination
            page={safePage}
            pages={pages}
            total={filtered.length}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={changeLimit}
          />
        )}
      </div>
    </>
  )
}
