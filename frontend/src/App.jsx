// src/App.jsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/components/layout/AppLayout'
import { FullPageLoader } from '@/components/ui/LoadingSpinner'

// Auth
import Login          from '@/pages/auth/Login'
import Signup         from '@/pages/auth/Signup'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword  from '@/pages/auth/ResetPassword'
import CompleteRegistration from '@/pages/auth/CompleteRegistration'

// Student
import StudentDashboard           from '@/pages/student/StudentDashboard'
import BookAppointment            from '@/pages/student/BookAppointment'
import MyAppointments             from '@/pages/student/MyAppointments'
import PreAssessmentForm          from '@/pages/student/PreAssessmentForm'
import PreAssessmentResults       from '@/pages/student/PreAssessmentResults'
import StudentPreAssessmentList   from '@/pages/student/StudentPreAssessmentList'
import StudentPreAssessmentDetail from '@/pages/student/StudentPreAssessmentDetail'
import Notifications              from '@/pages/shared/Notifications'
import Profile                    from '@/pages/shared/Profile'

// Counselor
import CounselorDashboard  from '@/pages/counselor/CounselorDashboard'
import ManageAvailability  from '@/pages/counselor/ManageAvailability'
import AppointmentRequest  from '@/pages/counselor/AppointmentRequest'
import PreAssessmentList   from '@/pages/counselor/PreAssessmentList'
import PreAssessmentDetail from '@/pages/counselor/PreAssessmentDetail'
import CounselorReferrals  from '@/pages/counselor/CounselorReferrals'
import ConsultationHistory from '@/pages/counselor/ConsultationHistory'
import Reports             from '@/pages/counselor/Reports'

// Faculty
import FacultyDashboard from '@/pages/faculty/FacultyDashboard'
import FacultyReferrals from '@/pages/faculty/FacultyReferrals'
import CreateReferral   from '@/pages/faculty/CreateReferral'

// ── Role → home path ──────────────────────────────────────────────────────────
const ROLE_HOME = {
  counselor: '/counselor/dashboard',
  faculty:   '/faculty/dashboard',
  student:   '/student/dashboard',
}

const roleHome = (role) => ROLE_HOME[role] ?? '/student/dashboard'

// ── Route guards ──────────────────────────────────────────────────────────────
function Protected({ children, role }) {
  const { user, isHydrating } = useAuthStore()
  if (isHydrating) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return <AppLayout>{children}</AppLayout>
}

function PublicOnly({ children }) {
  const { user, isHydrating } = useAuthStore()
  if (isHydrating) return <FullPageLoader />
  if (user) return <Navigate to={roleHome(user.role)} replace />
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { token, fetchMe } = useAuthStore()

  useEffect(() => {
    if (token) {
      fetchMe()
    } else {
      useAuthStore.setState({ isHydrating: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: '"Outfit", system-ui, sans-serif',
            fontSize: '13px',
            borderRadius: '12px',
          },
        }}
      />
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to={user ? roleHome(user.role) : '/login'} replace />} />

        {/* Public */}
        <Route path="/login"  element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        {/* Recovery — reachable regardless of auth state (e.g. opening a reset link while logged in) */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        {/* First-time Google sign-in completes here (guards on a pending Google session) */}
        <Route path="/complete-registration" element={<CompleteRegistration />} />

        {/* ── Student ── */}
        <Route path="/student/dashboard"                      element={<Protected role="student"><StudentDashboard /></Protected>} />
        <Route path="/student/book"                           element={<Protected role="student"><BookAppointment /></Protected>} />
        <Route path="/student/appointments"                   element={<Protected role="student"><MyAppointments /></Protected>} />
        <Route path="/student/pre-assessments"                element={<Protected role="student"><StudentPreAssessmentList /></Protected>} />
        <Route path="/student/pre-assessment/results"         element={<Protected role="student"><PreAssessmentResults /></Protected>} />
        <Route path="/student/pre-assessment/:appointmentId?" element={<Protected role="student"><PreAssessmentForm /></Protected>} />
        <Route path="/student/pre-assessment/:id/detail"      element={<Protected role="student"><StudentPreAssessmentDetail /></Protected>} />
        <Route path="/student/notifications"                  element={<Protected role="student"><Notifications /></Protected>} />
        <Route path="/student/profile"                        element={<Protected role="student"><Profile /></Protected>} />

        {/* ── Counselor ── */}
        <Route path="/counselor/dashboard"                    element={<Protected role="counselor"><CounselorDashboard /></Protected>} />
        <Route path="/counselor/schedule"                     element={<Protected role="counselor"><ManageAvailability /></Protected>} />
        <Route path="/counselor/appointments"                 element={<Protected role="counselor"><AppointmentRequest /></Protected>} />
        <Route path="/counselor/referrals"                    element={<Protected role="counselor"><CounselorReferrals /></Protected>} />
        <Route path="/counselor/pre-assessments"              element={<Protected role="counselor"><PreAssessmentList /></Protected>} />
        <Route path="/counselor/pre-assessments/:id"          element={<Protected role="counselor"><PreAssessmentDetail /></Protected>} />
        <Route path="/counselor/pre-assessments/appointment/:appointmentId" element={<Protected role="counselor"><PreAssessmentDetail byAppointment /></Protected>} />
        <Route path="/counselor/history"                      element={<Protected role="counselor"><ConsultationHistory /></Protected>} />
        <Route path="/counselor/reports"                      element={<Protected role="counselor"><Reports /></Protected>} />
        <Route path="/counselor/notifications"                element={<Protected role="counselor"><Notifications /></Protected>} />
        <Route path="/counselor/profile"                      element={<Protected role="counselor"><Profile /></Protected>} />

        {/* ── Faculty ── */}
        <Route path="/faculty/dashboard"                      element={<Protected role="faculty"><FacultyDashboard /></Protected>} />
        <Route path="/faculty/referrals"                      element={<Protected role="faculty"><FacultyReferrals /></Protected>} />
        <Route path="/faculty/referrals/new"                  element={<Protected role="faculty"><CreateReferral /></Protected>} />
        <Route path="/faculty/notifications"                  element={<Protected role="faculty"><Notifications /></Protected>} />
        <Route path="/faculty/profile"                        element={<Protected role="faculty"><Profile /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}