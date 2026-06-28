// src/api/index.js
import api from './axios'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup:         (data)   => api.post('/auth/signup', data),
  login:          (data)   => api.post('/auth/login', data),
  logout:         ()       => api.post('/auth/logout'),
  googleAuth:     (data)   => api.post('/auth/google', data),
  googleRegister: (data)   => api.post('/auth/google/register', data),
  getMe:          ()       => api.get('/auth/me'),
  updateProfile:  (data)   => api.put('/auth/update-profile', data),   // profile photo
  updateMyProfile:(data)   => api.patch('/auth/profile', data),        // editable details
  changePassword: (data)   => api.patch('/auth/change-password', data),
  updatePrivacyConsent:(data) => api.patch('/auth/privacy-consent', data),
  forgotPassword: (data)   => api.post('/auth/forgot-password', data),
  resetPassword:  (data)   => api.post('/auth/reset-password', data),
  sendEmailOtp:   ()       => api.post('/auth/send-email-otp'),
  verifyEmail:    (data)   => api.post('/auth/verify-email', data),
  getUsersByRole: (role)   => api.get(`/auth/users?role=${role}`),
}

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointmentAPI = {
  create:       (data)           => api.post('/appointments', data),
  getMyAll:     (params)         => api.get('/appointments/me', { params }),
  updateStatus: (id, data)       => api.patch(`/appointments/${id}/status`, data),
  reschedule:   (id, data)       => api.patch(`/appointments/${id}/reschedule`, data),
  cancel:       (id, data)       => api.patch(`/appointments/${id}/cancel`, data),
  delete:       (id)             => api.delete(`/appointments/${id}`),
  addFeedback:  (id, data)       => api.post(`/appointments/${id}/feedback`, data),
}

// ── Availability ──────────────────────────────────────────────────────────────
export const availabilityAPI = {
  set:    (data)   => api.post('/availability', data),
  get:    (params) => api.get('/availability', { params }),
  delete: (id)     => api.delete(`/availability/${id}`),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll:         (params) => api.get('/notifications', { params }),
  getUnreadCount: ()       => api.get('/notifications/unread-count'),
  markRead:       (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:    ()       => api.patch('/notifications/mark-all-read'),
  delete:         (id)     => api.delete(`/notifications/${id}`),
}

// ── Pre-Assessment ────────────────────────────────────────────────────────────
export const preAssessmentAPI = {
  // Timeout extended to 60s — the AI call is synchronous and Gemini free tier
  // can take 20–40s. The global axios timeout (15s) would abort it too early.
  submit:            (data)           => api.post('/pre-assessments', data, { timeout: 60000 }),
  getMyAll:          (params)         => api.get('/pre-assessments/my', { params }),
  getById:           (id)             => api.get(`/pre-assessments/${id}`),
  getByAppointment:  (appointmentId)  => api.get(`/pre-assessments/appointment/${appointmentId}`),
  getCounselorAll:   (params)         => api.get('/pre-assessments', { params }),
  getSummaryReport:  (params)         => api.get('/pre-assessments/report/summary', { params }),
  linkToAppointment: (id, data)       => api.patch(`/pre-assessments/${id}/link`, data),
  delete:            (id)             => api.delete(`/pre-assessments/${id}`),
}

// ── Referrals ─────────────────────────────────────────────────────────────────
export const referralAPI = {
  create:               (data)     => api.post('/referrals', data),
  getAll:               (params)   => api.get('/referrals', { params }),
  getAllAdmin:           (params)   => api.get('/referrals/all', { params }),
  getById:              (id)       => api.get(`/referrals/${id}`),
  updateStatus:         (id, data) => api.patch(`/referrals/${id}/status`, data),
  convert:              (id, data) => api.post(`/referrals/${id}/convert`, data),
  analytics:            ()         => api.get('/referrals/analytics'),
  getCounselorSchedules:(params)   => api.get('/referrals/counselor-schedules', { params }),
  requestAppointment:   (id, data) => api.post(`/referrals/${id}/request-appointment`, data),
  delete:               (id)       => api.delete(`/referrals/${id}`),
}

// ── Counselor Presence ────────────────────────────────────────────────────────
export const presenceAPI = {
  getAll:         ()     => api.get('/presence'),
  updateMyStatus: (data) => api.patch('/presence/me', data),
}

// ── Consultation History (Counselor only) ─────────────────────────────────────
export const consultationAPI = {
  getStudentList:    (params)            => api.get('/consultation-history/students', { params }),
  getStudentHistory: (studentId, params) => api.get(`/consultation-history/students/${studentId}`, { params }),
}

// ── Reports (Counselor only) ──────────────────────────────────────────────────
export const reportsAPI = {
  getFull: (params) => api.get('/reports', { params }),
}