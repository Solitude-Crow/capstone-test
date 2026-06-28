// src/pages/counselor/ConsultationHistory.jsx
import { useEffect, useState, useCallback } from 'react'

import {
  Search, Users, Calendar, CheckCircle2, Clock,
  ArrowLeft, ChevronRight, FileText, AlertCircle,
} from 'lucide-react'
import { consultationAPI } from '@/api'
import { formatDate, formatTime, timeAgo, STATUS_CLASS } from '@/lib/utils'
import PageBanner   from '@/components/ui/PageBanner'
import EmptyState   from '@/components/ui/EmptyState'
import SkeletonList from '@/components/ui/SkeletonList'
import Avatar       from '@/components/ui/Avatar'

// ── Student list view ─────────────────────────────────────────────────────────
function StudentList({ onSelect }) {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [query,    setQuery]    = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await consultationAPI.getStudentList({ search: query, limit: 50 })
      setStudents(data.students || [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { fetch() }, [fetch])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID or course…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {loading ? (
        <SkeletonList count={5} height="h-16" />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Students you've had appointments with will appear here."
        />
      ) : (
        <div className="space-y-2">
          {students.map((s) => (
            <button
              key={s._id}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-slate-50 transition-all text-left group"
            >
              <Avatar name={s.fullName} src={s.profilePic} size="md" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{s.fullName}</p>
                <p className="text-xs text-slate-500">
                  {s.studentIDnum && `${s.studentIDnum} · `}{s.course}{s.yearLevel && ` · ${s.yearLevel}`}
                </p>
                {s.lastAppointment && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last: {formatDate(s.lastAppointment.date)} · {s.appointmentCount} session{s.appointmentCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-primary-400 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status badge pill ─────────────────────────────────────────────────────────
function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

// ── Student history detail view ───────────────────────────────────────────────
function StudentHistoryView({ student, onBack }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', category: '', startDate: '', endDate: '' })
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const params = {}
    if (filters.status)    params.status    = filters.status
    if (filters.category)  params.category  = filters.category
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate)   params.endDate   = filters.endDate

    const loadHistory = async () => {
      setLoading(true)
      try {
        const { data: d } = await consultationAPI.getStudentHistory(student._id, params)
        setData(d)
      } catch {
        // silently ignore
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [student._id, filters])

  const summary   = data?.summary
  const appts     = data?.appointments ?? []
  const referrals = data?.referrals    ?? []

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar name={student.fullName} src={student.profilePic} size="md" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-slate-900 truncate">{student.fullName}</p>
            <p className="text-xs text-slate-500">{student.course} · {student.yearLevel}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Calendar,     label: 'Total Sessions',   value: summary.totalAppointments },
            { icon: CheckCircle2, label: 'Completed',        value: summary.completedSessions  },
            { icon: AlertCircle,  label: 'Referrals',        value: summary.referralCount      },
            { icon: Clock,        label: 'Pending',          value: summary.pendingAppointments},
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
              <item.icon size={16} className="text-primary-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-slate-900">{item.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top concerns */}
      {summary?.topConcerns?.length > 0 && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-100 rounded-xl">
          <p className="text-xs font-semibold text-primary-700 mb-1.5">Frequent Concerns</p>
          <div className="flex flex-wrap gap-2">
            {summary.topConcerns.map(({ type, count }) => (
              <span key={type} className="text-xs bg-white border border-primary-200 text-primary-700 rounded-full px-2.5 py-0.5 font-medium">
                {type} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">All Status</option>
          {['pending','accepted','completed','cancelled','rejected','rescheduled'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">All Categories</option>
          {['Academic Counseling','Personal/Emotional Counseling','Career Counseling','Family Concern','Social/Interpersonal','Financial Assistance','Health/Wellness','General Inquiry'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilter('startDate', e.target.value)}
          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
          placeholder="From"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilter('endDate', e.target.value)}
          className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
          placeholder="To"
        />
      </div>

      {loading ? (
        <SkeletonList count={4} height="h-20" />
      ) : appts.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments match your filters" description="Try adjusting the filters above." />
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-4 pl-10">
            {appts.map((appt) => (
              <div key={appt._id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-[26px] top-3 w-3 h-3 rounded-full border-2 border-white ${
                  appt.status === 'completed' ? 'bg-emerald-400'
                  : appt.status === 'pending'  ? 'bg-amber-400'
                  : appt.status === 'accepted' ? 'bg-blue-400'
                  : 'bg-slate-300'
                }`} />

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{appt.type}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(appt.date)} · {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                      </p>
                    </div>
                    <StatusPill status={appt.status} />
                  </div>

                  {appt.counselorId?.fullName && (
                    <p className="text-xs text-slate-500 mb-1">
                      Counselor: {appt.counselorId.fullName}
                    </p>
                  )}

                  {appt.counselorNotes && (
                    <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs font-medium text-slate-600 mb-0.5">Counselor notes</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{appt.counselorNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral history */}
      {referrals.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Referral History ({referrals.length})
          </p>
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r._id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <FileText size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{r.reason}</p>
                  <p className="text-xs text-slate-500">
                    By {r.facultyId?.fullName}{r.facultyId?.department && ` · ${r.facultyId.department}`}
                    {' · '}{timeAgo(r.createdAt)}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                  r.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                  : r.status === 'pending'  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ConsultationHistory() {
  const [selectedStudent, setSelectedStudent] = useState(null)

  return (
    <>
      <PageBanner
        title="Student Consultation History"
        subtitle={selectedStudent
          ? `Viewing history for ${selectedStudent.fullName}`
          : 'Full counseling records for all students you\'ve worked with'
        }
      />

      <div className="max-w-3xl mx-auto">
        {selectedStudent ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
            <StudentHistoryView
              student={selectedStudent}
              onBack={() => setSelectedStudent(null)}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
            <StudentList onSelect={setSelectedStudent} />
          </div>
        )}
      </div>
    </>
  )
}