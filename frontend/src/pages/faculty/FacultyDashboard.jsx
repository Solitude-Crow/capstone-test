// src/pages/faculty/FacultyDashboard.jsx
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Users, Clock, CheckCircle2, XCircle, AlertTriangle, Plus, ArrowRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useAuthStore } from '@/store/authStore'
import { referralAPI, availabilityAPI, authAPI } from '@/api'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import SkeletonList from '@/components/ui/SkeletonList'
import EmptyState from '@/components/ui/EmptyState'
import ReferralCard from '@/components/ui/ReferralCard'
import UrgencyBadge from '@/components/ui/UrgencyBadge'
import ReferralStatusBadge from '@/components/ui/ReferralStatusBadge'
import GuidanceCalendar from '@/components/ui/GuidanceCalendar'

export default function FacultyDashboard() {
  const { user } = useAuthStore()
  const [referrals,       setReferrals]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [counselors,      setCounselors]      = useState([])
  const [availability,    setAvailability]    = useState([])
  const [calendarMonth,   setCalendarMonth]   = useState(new Date())
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  useEffect(() => {
    referralAPI.getAll({ limit: 50 })
      .then(({ data }) => setReferrals(data.referrals || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    authAPI.getUsersByRole('counselor')
      .then(({ data }) => setCounselors(data.users || data || []))
      .catch(() => {})
  }, [])

  // Fetch availability for current calendar month
  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoadingCalendar(true)
      try {
        const start = format(startOfMonth(calendarMonth), 'yyyy-MM-dd')
        const end   = format(endOfMonth(calendarMonth),   'yyyy-MM-dd')
        const results = await Promise.allSettled(
          counselors.map((c) =>
            availabilityAPI.get({ counselorId: c._id, startDate: start, endDate: end })
              .then(({ data }) => data)
          )
        )
        const all = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value)
        setAvailability(all)
      } catch {
        // silently ignore
      } finally {
        setLoadingCalendar(false)
      }
    }

    if (counselors.length > 0) {
      fetchCalendarData()
    } else {
      setLoadingCalendar(false)
    }
  }, [calendarMonth, counselors])

  const handleCalendarMonthChange = useCallback((newMonth) => {
    setCalendarMonth(newMonth)
  }, [])

  const counts = {
    total:     referrals.length,
    pending:   referrals.filter((r) => r.status === 'pending').length,
    accepted:  referrals.filter((r) => ['accepted', 'scheduled'].includes(r.status)).length,
    completed: referrals.filter((r) => r.status === 'completed').length,
    rejected:  referrals.filter((r) => r.status === 'rejected').length,
  }

  const urgent = referrals.filter((r) =>
    ['high', 'critical'].includes(r.urgency) && r.status === 'pending'
  )

  const greeting = new Date().getHours() < 12 ? 'morning'
    : new Date().getHours() < 17 ? 'afternoon' : 'evening'

  return (
    <div className="animate-fade-in max-w-7xl mx-auto px-2 lg:px-4">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title text-2xl sm:text-3xl">
          Good {greeting},{' '}
          <span className="text-primary-500">{user?.fullName?.split(' ')[0]}</span>
        </h1>
        <p className="page-subtitle text-sm sm:text-base">
          {user?.department && <span className="font-medium">{user.department} · </span>}
          Faculty Referral Portal
        </p>
      </div>

      {/* Urgent alert */}
      {!loading && urgent.length > 0 && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-800 flex-1">
            {urgent.length} pending referral{urgent.length > 1 ? 's' : ''} with high or critical urgency require attention.
          </p>
          <Link to="/faculty/referrals" className="text-xs font-semibold text-red-600 hover:underline shrink-0">
            View →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard icon={Users}       label="Total Referred"    count={counts.total}     colorBg="bg-primary-50"  colorIcon="text-primary-500" />
        <StatCard icon={Clock}       label="Pending"           count={counts.pending}   colorBg="bg-amber-50"    colorIcon="text-amber-500"   />
        <StatCard icon={CheckCircle2}label="In Progress"       count={counts.accepted}  colorBg="bg-emerald-50"  colorIcon="text-emerald-500" />
        <StatCard icon={XCircle}     label="Rejected"          count={counts.rejected}  colorBg="bg-red-50"      colorIcon="text-red-400"     />
      </div>

      {/* Quick action */}
      <div className="mb-6">
        <Link
          to="/faculty/referrals/new"
          className="flex items-center gap-4 p-4 sm:p-5 bg-primary-500 hover:bg-primary-600 rounded-xl text-white transition-colors group"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Plus size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Submit New Referral</p>
            <p className="text-white/70 text-xs mt-0.5">Refer a student to the Guidance Counselor</p>
          </div>
          <ArrowRight size={16} className="text-white/60 group-hover:text-white transition-colors" />
        </Link>
      </div>

      {/* Counselor availability calendar */}
      <div className="mb-6">
        <GuidanceCalendar
          role="student"
          appointments={[]}
          availability={availability}
          counselors={counselors}
          isLoading={loadingCalendar && counselors.length > 0}
          onMonthChange={handleCalendarMonthChange}
        />
      </div>

      {/* Recent referrals + status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent list */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent Referrals"
            action={
              <Link to="/faculty/referrals" className="text-xs text-primary-500 font-semibold hover:underline">
                View all
              </Link>
            }
          >
            {loading ? (
              <SkeletonList count={3} height="h-24" />
            ) : referrals.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No referrals yet"
                description="Submit your first referral to get started."
                action={
                  <Link to="/faculty/referrals/new" className="btn btn-primary btn-sm gap-1">
                    <Plus size={14} /> New Referral
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {referrals.slice(0, 5).map((r) => (
                  <ReferralCard key={r._id} referral={r} viewerRole="faculty" />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Status breakdown */}
        <SectionCard title="Referral Status">
          {loading ? (
            <SkeletonList count={5} height="h-10" />
          ) : referrals.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-3">
              {[
                { status: 'pending',   count: counts.pending   },
                { status: 'accepted',  count: counts.accepted  },
                { status: 'completed', count: counts.completed },
                { status: 'rejected',  count: counts.rejected  },
              ].map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between">
                  <ReferralStatusBadge status={status} />
                  <span className="font-bold text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          )}

          {referrals.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By Urgency</p>
              {['low', 'medium', 'high', 'critical'].map((u) => {
                const n = referrals.filter((r) => r.urgency === u).length
                if (!n) return null
                return (
                  <div key={u} className="flex items-center justify-between">
                    <UrgencyBadge urgency={u} />
                    <span className="font-bold text-slate-800">{n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}