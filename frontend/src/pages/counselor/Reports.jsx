// src/pages/counselor/Reports.jsx
import { useState, useEffect, useCallback } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  BarChart3, Users, AlertTriangle, CheckCircle2, FileText,
  CalendarDays, TrendingUp, Award,
} from 'lucide-react'
import { preAssessmentAPI, reportsAPI } from '@/api'
import toast from 'react-hot-toast'

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

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)))
  const [endDate,   setEndDate]   = useState(new Date())
  const [report,    setReport]    = useState(null)
  const [preReport, setPreReport] = useState(null)
  const [loading,   setLoading]   = useState(false)

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

  useEffect(() => { fetchReport() }, [fetchReport])

  const refs  = report?.referrals
  const appts = report?.appointments
  const pre   = preReport?.stats

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics &amp; Reports</h1>
        <p className="page-subtitle">Comprehensive guidance office data and insights</p>
      </div>

      {/* Date range */}
      <div className="card mb-6 flex items-end gap-4 flex-wrap">
        <div className="min-w-[160px]">
          <label className="field-label">From</label>
          <DatePicker selected={startDate} onChange={setStartDate}
            className="field-input" dateFormat="MMM d, yyyy" />
        </div>
        <div className="min-w-[160px]">
          <label className="field-label">To</label>
          <DatePicker selected={endDate} onChange={setEndDate}
            className="field-input" dateFormat="MMM d, yyyy" minDate={startDate} />
        </div>
        <button onClick={fetchReport} disabled={loading} className="btn btn-primary gap-1.5">
          <BarChart3 size={16} /> {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {/* ── Overview stats ── */}
      {(pre || appts || refs) && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Pre-Assessments', count: pre?.total ?? 0,          Icon: FileText,     color: 'bg-primary-50',  iconColor: 'text-primary-500' },
              { label: 'Appointments',    count: appts?.total ?? 0,         Icon: CalendarDays, color: 'bg-blue-50',     iconColor: 'text-blue-500' },
              { label: 'Referrals',       count: refs?.total ?? 0,          Icon: Users,        color: 'bg-violet-50',   iconColor: 'text-violet-500' },
              { label: 'Completion Rate', count: `${appts?.completionRate ?? 0}%`, Icon: CheckCircle2, color: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            ].map((item) => (
              <div key={item.label} className="stat-card">
                <div className={`stat-icon ${item.color}`}>
                  <item.Icon size={20} className={item.iconColor} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 font-display">{item.count}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Referral section ── */}
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
                      <BarRow key={_id} label={_id} count={count} total={refs.total}
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

          {/* ── Monthly trend ── */}
          {appts?.monthlyTrend?.length > 0 && (
            <div className="card mb-6">
              <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-500" /> Monthly Appointment Trends
              </h2>
              <div className="overflow-x-auto pb-1">
                <div
                  className="flex items-end gap-4 sm:gap-6"
                  style={{ minWidth: `${Math.max(appts.monthlyTrend.length * 72, 360)}px` }}
                >
                  {(() => {
                    const maxVal = Math.max(...appts.monthlyTrend.map((x) => x.total), 1)
                    return appts.monthlyTrend.map((m) => {
                      // Heights are a % of the fixed-height plot area below, so they
                      // resolve correctly (the old code sized bars as a % of an
                      // auto-height parent, which collapsed them to a hairline).
                      const totalPct = Math.max(Math.round((m.total / maxVal) * 100), m.total > 0 ? 3 : 0)
                      const donePct  = m.completed > 0
                        ? Math.max(Math.round((m.completed / maxVal) * 100), 3)
                        : 0
                      return (
                        <div key={`${m._id.year}-${m._id.month}`} className="flex-1 flex flex-col items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-700">{m.total}</span>
                          {/* Fixed-height plot area gives the bars a definite height to size against */}
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
                          <span className="text-[10px] text-slate-400">
                            {MONTH_NAMES[(m._id.month ?? 1) - 1]} &apos;{String(m._id.year).slice(2)}
                          </span>
                        </div>
                      )
                    })
                  })()}
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
            </div>
          )}

          {/* ── Appointment types + concerns ── */}
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
                    .map(([concern, count]) => (
                      <BarRow key={concern} label={concern} count={count} total={pre.total} />
                    ))}
                </div>
              </div>
            )}
          </div>

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

          {/* ── Pre-assessment urgency ── */}
          {pre?.byUrgency && Object.keys(pre.byUrgency).length > 0 && (
            <div className="card">
              <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" /> Pre-Assessments by Urgency
              </h2>
              <div className="space-y-3">
                {['Immediate', 'High', 'Moderate', 'Low'].map((level) => (
                  <BarRow key={level} label={level} count={pre.byUrgency[level] || 0} total={pre.total}
                    color={URGENCY_COLORS[level] ?? 'from-slate-400 to-slate-300'} />
                ))}
                {/* Legacy data used "Crisis" before the form adopted "Immediate" */}
                {(pre.byUrgency['Crisis'] || 0) > 0 && (
                  <BarRow label="Crisis (legacy)" count={pre.byUrgency['Crisis']} total={pre.total}
                    color={URGENCY_COLORS.Crisis} />
                )}
              </div>
            </div>
          )}

          {/* ── Pre-assessment risk level (rule-based engine) ── */}
          {pre?.byRiskLevel && Object.keys(pre.byRiskLevel).length > 0 && (
            <div className="card">
              <h2 className="font-display text-lg text-slate-900 mb-5 flex items-center gap-2">
                <BarChart3 size={18} className="text-primary-500" /> Pre-Assessments by Risk Level
              </h2>
              <div className="space-y-3">
                {['Critical', 'High', 'Moderate', 'Low'].map((level) => (
                  <BarRow key={level} label={level} count={pre.byRiskLevel[level] || 0} total={pre.total}
                    color={URGENCY_COLORS[level] ?? 'from-slate-400 to-slate-300'} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
