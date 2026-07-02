// src/pages/counselor/Reports.jsx
// Analytics dashboard — loads automatically for the selected date range.
// Three sections: Overview (appointment / pre-assessment / referral / completion
// analytics), Student History and Referral History.
import { useState, useEffect, useCallback } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { subMonths, startOfMonth } from 'date-fns'
import {
  BarChart3, Users, AlertTriangle, CheckCircle2, FileText,
  CalendarDays, TrendingUp, Award, History, GitBranch, RefreshCw,
} from 'lucide-react'
import { preAssessmentAPI, reportsAPI, referralAPI } from '@/api'
import { formatDate, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import StatusBadge from '@/components/ui/StatusBadge'
import ReferralStatusBadge from '@/components/ui/ReferralStatusBadge'
import UrgencyBadge from '@/components/ui/UrgencyBadge'
import Avatar from '@/components/ui/Avatar'
import SkeletonList from '@/components/ui/SkeletonList'
import { StudentList, StudentHistoryView } from '@/pages/counselor/ConsultationHistory'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const URGENCY_COLORS = {
  Immediate: 'from-red-500 to-red-400',
  Crisis:    'from-red-600 to-red-500',
  Critical:  'from-red-500 to-red-400',
  High:      'from-orange-500 to-orange-400',
  Moderate:  'from-blue-500 to-blue-400',
  Low:       'from-slate-400 to-slate-300',
  low:       'from-slate-400 to-slate-300',
  medium:    'from-blue-500 to-blue-400',
  high:      'from-orange-500 to-orange-400',
  critical:  'from-red-500 to-red-400',
}

function BarRow({ label, count, total, color = 'from-primary-500 to-accent-500' }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700 truncate max-w-[60%]">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{count}</span>
      </div>
      <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* Dual-bar trend chart (total vs completed) used for monthly + weekly trends */
function DualBarChart({ items }) {
  if (!items?.length) return null
  const maxVal = Math.max(...items.map((x) => x.total), 1)
  return (
    <>
      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-end gap-4 sm:gap-6"
          style={{ minWidth: `${Math.max(items.length * 72, 360)}px` }}
        >
          {items.map((m) => {
            const totalPct = Math.max(Math.round((m.total / maxVal) * 100), m.total > 0 ? 3 : 0)
            const donePct  = m.completed > 0
              ? Math.max(Math.round((m.completed / maxVal) * 100), 3)
              : 0
            return (
              <div key={m.id} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700">{m.total}</span>
                <div className="w-full h-32 flex items-end justify-center gap-1.5">
                  <div
                    className="w-1/2 max-w-[26px] rounded-t-md bg-gradient-to-t from-primary-500 to-primary-400 transition-all duration-500"
                    style={{ height: `${totalPct}%` }}
                    title={`Total: ${m.total}`}
                  />
                  <div
                    className="w-1/2 max-w-[26px] rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ height: `${donePct}%` }}
                    title={`Completed: ${m.completed || 0}`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary-400" />
          <span className="text-xs text-slate-500">Total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-400 opacity-70" />
          <span className="text-xs text-slate-500">Completed</span>
        </div>
      </div>
    </>
  )
}

/* ── Referral History tab ─────────────────────────────────────────────────── */
const REFERRAL_STATUSES = ['all', 'pending', 'under_review', 'accepted', 'scheduled', 'completed', 'rejected']

function ReferralHistory() {
  const [referrals, setReferrals] = useState([])
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  useEffect(() => {
    let cancelled = false
    async function fetchReferrals() {
      setLoading(true)
      try {
        const { data } = await referralAPI.getAllAdmin({ page, limit, ...(status !== 'all' && { status }) })
        if (!cancelled) {
          setReferrals(data.referrals || [])
          setPagination(data.pagination || { total: 0, pages: 1 })
        }
      } catch {
        toast.error('Failed to load referral history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchReferrals()
    return () => { cancelled = true }
  }, [status, page, limit])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {REFERRAL_STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              status === s
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-surface-200 text-slate-600 hover:border-primary-300'
            }`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={5} height="h-20" />
      ) : referrals.length === 0 ? (
        <div className="card">
          <EmptyState icon={GitBranch} title="No referrals found" description="Referrals matching this filter will appear here." />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-200 bg-surface-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Faculty</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Counselor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Urgency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Appointment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const studentName = r.studentId?.fullName ?? r.studentSnapshot?.fullName ?? '—'
                  const appt = r.appointmentId
                  return (
                    <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={studentName} src={r.studentId?.profilePic} size="xs" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate max-w-[140px]">{studentName}</p>
                            {r.studentId?.course && (
                              <p className="text-[11px] text-slate-400">{r.studentId.course}{r.studentId.yearLevel && ` · ${r.studentId.yearLevel}`}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{r.facultyId?.fullName ?? '—'}</p>
                        {r.facultyId?.department && (
                          <p className="text-[11px] text-slate-400">{r.facultyId.department}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.counselorId?.fullName ?? '—'}</td>
                      <td className="px-4 py-3"><UrgencyBadge urgency={r.priorityLevel ?? r.urgency} /></td>
                      <td className="px-4 py-3"><ReferralStatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        {appt ? (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-600 whitespace-nowrap">
                              {formatDate(appt.date)}{appt.startTime && ` · ${formatTime(appt.startTime)}`}
                            </p>
                            <StatusBadge status={appt.status} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && pagination.total > 0 && (
        <Pagination
          page={page}
          pages={pagination.pages || 1}
          total={pagination.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(n) => { setLimit(n); setPage(1) }}
        />
      )}
    </div>
  )
}

/* ── Student History tab (reuses the consultation-history views) ──────────── */
function StudentHistory() {
  const [selectedStudent, setSelectedStudent] = useState(null)
  return (
    <div className="card">
      {selectedStudent ? (
        <StudentHistoryView student={selectedStudent} onBack={() => setSelectedStudent(null)} />
      ) : (
        <StudentList onSelect={setSelectedStudent} />
      )}
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
const TABS = [
  { value: 'overview',  label: 'Overview',         Icon: BarChart3 },
  { value: 'students',  label: 'Student History',  Icon: History   },
  { value: 'referrals', label: 'Referral History', Icon: GitBranch },
]

export default function Reports() {
  // Default range: the last 12 months, so the dashboard is populated on load
  const [startDate, setStartDate] = useState(() => subMonths(startOfMonth(new Date()), 11))
  const [endDate,   setEndDate]   = useState(new Date())
  const [report,    setReport]    = useState(null)
  const [preReport, setPreReport] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [tab,       setTab]       = useState('overview')

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
      const [fullRes, preRes] = await Promise.all([
        reportsAPI.getFull(params),
        preAssessmentAPI.getSummaryReport(params),
      ])
      setReport(fullRes.data)
      setPreReport(preRes.data)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  // Auto-load on mount and whenever the range changes
  useEffect(() => { fetchReport() }, [fetchReport])

  const refs  = report?.referrals
  const appts = report?.appointments
  const compl = report?.completion
  const pre   = preReport?.stats

  const monthlyItems = (appts?.monthlyTrend ?? []).map((m) => ({
    id: `${m._id.year}-${m._id.month}`,
    label: `${MONTH_NAMES[(m._id.month ?? 1) - 1]} '${String(m._id.year).slice(2)}`,
    total: m.total,
    completed: m.completed,
  }))

  const weeklyItems = (appts?.weeklyTrend ?? []).slice(-12).map((w) => ({
    id: `${w._id.year}-w${w._id.week}`,
    label: `W${w._id.week} '${String(w._id.year).slice(2)}`,
    total: w.total,
    completed: w.completed,
  }))

  const preMonthly = Object.entries(pre?.byMonth ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      return { id: key, label: `${MONTH_NAMES[Number(m) - 1]} '${y.slice(2)}`, total: count, completed: 0 }
    })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics &amp; Reports</h1>
        <p className="page-subtitle">Comprehensive guidance office data and insights — updates automatically</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.value
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-surface-200 text-slate-600 hover:border-primary-300'
            }`}
          >
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentHistory />}
      {tab === 'referrals' && <ReferralHistory />}

      {tab === 'overview' && (
        <>
          {/* Date range — the report refreshes automatically on change.
              Stacks vertically on phones, sits on one row from `sm` up. */}
          <div className="card mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <label className="field-label">From</label>
              <DatePicker selected={startDate} onChange={setStartDate}
                className="field-input" dateFormat="MMM d, yyyy" />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <label className="field-label">To</label>
              <DatePicker selected={endDate} onChange={setEndDate}
                className="field-input" dateFormat="MMM d, yyyy" minDate={startDate} />
            </div>
            <button onClick={fetchReport} disabled={loading} className="btn btn-outline btn-primary gap-1.5 w-full sm:w-auto">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {(pre || appts || refs) && (
            <>
              {/* ── Overview stats ── */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'Pre-Assessments',      count: pre?.total ?? 0,                    Icon: FileText,     color: 'bg-primary-50',  iconColor: 'text-primary-500' },
                  { label: 'Appointments',         count: appts?.total ?? 0,                  Icon: CalendarDays, color: 'bg-blue-50',     iconColor: 'text-blue-500' },
                  { label: 'Referrals',            count: refs?.total ?? 0,                   Icon: Users,        color: 'bg-violet-50',   iconColor: 'text-violet-500' },
                  { label: 'Appt. Completion',     count: `${compl?.appointmentRate ?? appts?.completionRate ?? 0}%`, Icon: CheckCircle2, color: 'bg-emerald-50', iconColor: 'text-emerald-500' },
                  { label: 'Referral Completion',  count: `${compl?.referralRate ?? 0}%`,     Icon: CheckCircle2, color: 'bg-teal-50',     iconColor: 'text-teal-500' },
                  { label: 'Overall Completion',   count: `${compl?.overallRate ?? 0}%`,      Icon: TrendingUp,   color: 'bg-amber-50',    iconColor: 'text-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="stat-card">
                    <div className={`stat-icon ${item.color}`}>
                      <item.Icon size={20} className={item.iconColor} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-slate-900 font-display">{item.count}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Appointment analytics ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="card">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <CalendarDays size={18} className="text-blue-500" /> Appointments by Status
                  </h2>
                  {(appts?.byStatus ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                  ) : (
                    <div className="space-y-3">
                      {appts.byStatus.map(({ _id, count }) => (
                        <BarRow key={_id} label={_id} count={count} total={appts.total}
                          color="from-blue-500 to-blue-400" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <GitBranch size={18} className="text-violet-500" /> Appointments by Source
                  </h2>
                  {(appts?.bySource ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                  ) : (
                    <div className="space-y-3">
                      {appts.bySource.map(({ _id, count }) => (
                        <BarRow key={_id} label={_id} count={count} total={appts.total}
                          color={_id === 'Faculty Referral' ? 'from-violet-500 to-violet-400' : 'from-primary-500 to-primary-400'} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-500" /> Year-over-Year
                  </h2>
                  {(appts?.yearly ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                  ) : (
                    <div className="space-y-4">
                      {appts.yearly.map((y) => (
                        <div key={y._id}>
                          <BarRow label={`${y._id}`} count={y.total}
                            total={Math.max(...appts.yearly.map((x) => x.total), 1)}
                            color="from-emerald-500 to-emerald-400" />
                          <p className="text-[11px] text-slate-400 mt-1">
                            {y.completed} completed · {y.total > 0 ? Math.round((y.completed / y.total) * 100) : 0}% completion
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Monthly + weekly trends ── */}
              {monthlyItems.length > 0 && (
                <div className="card mb-6">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-500" /> Monthly Appointment Trends
                  </h2>
                  <DualBarChart items={monthlyItems} />
                </div>
              )}

              {weeklyItems.length > 1 && (
                <div className="card mb-6">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-500" /> Weekly Appointment Trends
                  </h2>
                  <DualBarChart items={weeklyItems} />
                </div>
              )}

              {/* ── Referral analytics ── */}
              {refs && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <Users size={18} className="text-violet-500" /> Referrals by Status
                    </h2>
                    {refs.byStatus.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                    ) : (
                      <div className="space-y-3">
                        {refs.byStatus.map(({ _id, count }) => (
                          <BarRow key={_id} label={_id?.replace('_', ' ')} count={count} total={refs.total}
                            color="from-violet-500 to-violet-400" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-orange-500" /> Referrals by Urgency
                    </h2>
                    {refs.byUrgency.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                    ) : (
                      <div className="space-y-3">
                        {refs.byUrgency.map(({ _id, count }) => (
                          <BarRow key={_id} label={_id} count={count} total={refs.total}
                            color={URGENCY_COLORS[_id] ?? 'from-slate-400 to-slate-300'} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={18} className="text-primary-500" /> Referrals by Department
                    </h2>
                    {refs.byDepartment.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No data in selected range</p>
                    ) : (
                      <div className="space-y-3">
                        {refs.byDepartment.slice(0, 6).map(({ _id, count }) => (
                          <BarRow key={_id} label={_id} count={count} total={refs.total} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Referral categories + top faculty ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {(refs?.byCategory ?? []).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={18} className="text-violet-500" /> Referral Categories
                    </h2>
                    <div className="space-y-3">
                      {refs.byCategory.slice(0, 8).map(({ _id, count }) => (
                        <BarRow key={_id} label={_id ?? 'Uncategorized'} count={count} total={refs.total}
                          color="from-violet-500 to-violet-400" />
                      ))}
                    </div>
                  </div>
                )}

                {(refs?.topFaculty ?? []).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <Award size={18} className="text-amber-500" /> Faculty with Most Referrals
                    </h2>
                    <div className="space-y-3">
                      {refs.topFaculty.map((f) => (
                        <div key={f._id ?? f.facultyName} className="flex items-center gap-3">
                          <Avatar name={f.facultyName ?? '—'} size="xs" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{f.facultyName ?? '—'}</p>
                            {f.department && <p className="text-[11px] text-slate-400">{f.department}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900">{f.count}</p>
                            <p className="text-[10px] text-slate-400">{f.completed} completed</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Appointment types + pre-assessment concerns ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {appts?.byType?.length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <CalendarDays size={18} className="text-blue-500" /> Appointments by Type
                    </h2>
                    <div className="space-y-3">
                      {appts.byType.slice(0, 8).map(({ _id, count }) => (
                        <BarRow key={_id} label={_id} count={count} total={appts.total}
                          color="from-blue-500 to-blue-400" />
                      ))}
                    </div>
                  </div>
                )}

                {pre?.byConcern && Object.keys(pre.byConcern).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={18} className="text-primary-500" /> Pre-Assessments by Concern
                    </h2>
                    <div className="space-y-3">
                      {Object.entries(pre.byConcern)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 8)
                        .map(([concern, count]) => (
                          <BarRow key={concern} label={concern} count={count} total={pre.total} />
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Pre-assessment analytics ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {pre?.byUrgency && Object.keys(pre.byUrgency).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-amber-500" /> Self-Reported Urgency
                    </h2>
                    <div className="space-y-3">
                      {['Immediate', 'High', 'Moderate', 'Low'].map((level) => (
                        <BarRow key={level} label={level} count={pre.byUrgency[level] || 0} total={pre.total}
                          color={URGENCY_COLORS[level] ?? 'from-slate-400 to-slate-300'} />
                      ))}
                      {(pre.byUrgency['Crisis'] || 0) > 0 && (
                        <BarRow label="Crisis (legacy)" count={pre.byUrgency['Crisis']} total={pre.total}
                          color={URGENCY_COLORS.Crisis} />
                      )}
                    </div>
                  </div>
                )}

                {pre?.byRiskLevel && Object.keys(pre.byRiskLevel).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={18} className="text-red-400" /> Risk Levels
                    </h2>
                    <div className="space-y-3">
                      {['Critical', 'High', 'Moderate', 'Low'].map((level) => (
                        <BarRow key={level} label={level} count={pre.byRiskLevel[level] || 0} total={pre.total}
                          color={URGENCY_COLORS[level] ?? 'from-slate-400 to-slate-300'} />
                      ))}
                    </div>
                  </div>
                )}

                {pre?.byDetectedCategory && Object.keys(pre.byDetectedCategory).length > 0 && (
                  <div className="card">
                    <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={18} className="text-primary-500" /> AI-Detected Categories
                    </h2>
                    <div className="space-y-3">
                      {Object.entries(pre.byDetectedCategory)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([cat, count]) => (
                          <BarRow key={cat} label={cat} count={count} total={pre.total} />
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Pre-assessment monthly submissions ── */}
              {preMonthly.length > 1 && (
                <div className="card mb-6">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary-500" /> Monthly Pre-Assessment Submissions
                  </h2>
                  <DualBarChart items={preMonthly} />
                </div>
              )}

              {/* ── Counselor workload ── */}
              {report?.counselorWorkload?.length > 0 && (
                <div className="card mb-6">
                  <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                    <Award size={18} className="text-primary-500" /> Counselor Workload Distribution
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Counselor</th>
                          <th className="text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                          <th className="text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</th>
                          <th className="text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.counselorWorkload.map((c) => (
                          <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2.5 font-medium text-slate-800">{c.counselorName ?? '—'}</td>
                            <td className="py-2.5 text-center font-bold text-slate-900">{c.total}</td>
                            <td className="py-2.5 text-center text-emerald-600 font-semibold">{c.completed}</td>
                            <td className="py-2.5 text-center text-amber-600 font-semibold">{c.pending}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
