// src/lib/utils.js
import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns'

export const formatDate = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d, yyyy')
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

export const formatDateLong = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM d, yyyy')
}

export const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

export const timeAgo = (date) => {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export const getInitials = (name = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const STATUS_COLORS = {
  pending:     'badge-pending',
  accepted:    'badge-accepted',
  rejected:    'badge-rejected',
  cancelled:   'badge-cancelled',
  completed:   'badge-completed',
  rescheduled: 'badge-rescheduled',
}

// Alias used by StatusBadge
export const STATUS_CLASS = STATUS_COLORS

export const APPOINTMENT_TYPES = [
  'Academic Counseling',
  'Personal/Emotional Counseling',
  'Career Counseling',
  'Family Concern',
  'Social/Interpersonal',
  'Financial Assistance',
  'Health/Wellness',
  'General Inquiry',
]

export const CONCERN_TYPES = [
  'Academic',
  'Personal/Emotional',
  'Career',
  'Family',
  'Social/Interpersonal',
  'Financial',
  'Health/Wellness',
  'Other',
]

export const URGENCY_LEVELS = ['Low', 'Moderate', 'High', 'Crisis']

export const COURSES = ['ABIS', 'BSIS', 'BECED', 'BSED', 'BHUMS']

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

// ── Faculty Referral Form constants ──────────────────────────────────────────

export const REFERRAL_INDICATORS = {
  'Academic': [
    'Sudden Drop in Grades',
    'Frequent Absences',
    'Late Submission of Requirements',
    'Lack of Participation / Classroom Engagement',
    'At Risk of Academic Failure / Probation',
  ],
  'Behavioral': [
    'Withdrawal / Social Isolation',
    'Aggressive or Disruptive Behavior',
    'Frequent Emotional Outbursts',
    'Difficulty Following Rules or Instructions',
    'Difficulty Interacting with Peers or Teachers',
  ],
  'Emotional / Psychological': [
    'Visible Signs of Stress or Anxiety',
    'Persistent Sadness or Hopelessness',
    'Emotional Instability / Mood Swings',
    'Signs of Burnout or Exhaustion',
    'Low Self-Confidence or Self-Esteem Issues',
    'Expressed Difficulty Coping',
  ],
  'Family / Social': [
    'Family-Related Problems',
    'Financial Difficulties Affecting Studies',
    'Peer Conflicts or Bullying',
    'Romantic or Relationship Issues',
    'Significant Life Changes / Loss',
  ],
  'Wellness / Safety': [
    'Risk of Self-Harm or Suicidal Ideation',
    'Concerning Statements About Well-being',
    'Sudden Behavioral or Physical Changes',
    'Other Welfare Concern',
  ],
}

export const ACTIONS_TAKEN_OPTIONS = [
  'Talked with the Student Personally',
  'Contacted Parent or Guardian',
  'Coordinated with Class Adviser',
  'Referred to Program Head / Department Chair',
  'No Formal Action Taken Yet',
]

export const PRIORITY_LEVELS = [
  {
    value: 'low',
    label: 'LOW',
    color: 'emerald',
    bgClass:   'bg-emerald-50',
    borderClass: 'border-emerald-300',
    textClass:  'text-emerald-700',
    desc: 'General concern. Student may benefit from counseling at a convenient time.',
  },
  {
    value: 'moderate',
    label: 'MODERATE',
    color: 'blue',
    bgClass:   'bg-blue-50',
    borderClass: 'border-blue-300',
    textClass:  'text-blue-700',
    desc: 'Repeated or recurring concern. Counseling session recommended at earliest convenience.',
  },
  {
    value: 'high',
    label: 'HIGH',
    color: 'orange',
    bgClass:   'bg-orange-50',
    borderClass: 'border-orange-300',
    textClass:  'text-orange-700',
    desc: 'Serious issue. Counselor follow-up required within 24–48 hours. All counselors notified.',
  },
  {
    value: 'critical',
    label: 'CRITICAL',
    color: 'red',
    bgClass:   'bg-red-50',
    borderClass: 'border-red-300',
    textClass:  'text-red-700',
    desc: 'Crisis situation — possible risk of harm. Urgent intervention required. All counselors notified immediately.',
  },
]

export const STUDENT_AWARENESS_OPTIONS = [
  'Student has been informed about this referral',
  'Student has not yet been informed about this referral',
  'Student declined to independently seek counseling assistance',
  'Student is not using the Gab.AI guidance system',
]

export const PRE_ASSESSMENT_QUESTIONS = [
  'How long have you been experiencing this concern?',
  'Have you sought help for this concern before? If yes, what kind?',
  'How is this concern affecting your studies or daily life?',
  'Is there anything specific you hope to get from this counseling session?',
  'On a scale of 1–10, how much is this concern affecting your well-being?',
]

// ── MKD Pre-Assessment Form constants ────────────────────────────────────────

export const PURPOSE_OF_VISIT_OPTIONS = [
  'Academic Concerns',
  'Personal Concerns',
  'Family Concerns',
  'Career Planning',
  'Emotional or Mental Well-being',
  'Relationship Concerns',
  'Financial Concerns',
  'Stress Management',
  'Behavioral Concerns',
  'Scholarship Concerns',
  'Adjustment to College Life',
  'Others',
]

export const LIKERT_STATEMENTS = [
  'I feel overwhelmed by school requirements.',
  'I have difficulty concentrating in class.',
  'I feel stressed or anxious frequently.',
  'I experience problems with friends or classmates.',
  'I have concerns regarding my family situation.',
  'I am uncertain about my future career path.',
  'I feel isolated or unsupported.',
  'My concerns affect my academic performance.',
]

export const LIKERT_LABELS = {
  1: 'Never',
  2: 'Rarely',
  3: 'Sometimes',
  4: 'Often',
  5: 'Always',
}

export const CONCERN_CATEGORIES = {
  'Academic': [
    'Low Grades',
    'Poor Study Habits',
    'Attendance Issues',
    'Difficulty Understanding Lessons',
    'Time Management',
    'Academic Burnout',
  ],
  'Personal and Emotional': [
    'Stress',
    'Anxiety',
    'Low Self-Esteem',
    'Emotional Distress',
    'Motivation Issues',
    'Self-Confidence Issues',
  ],
  'Social and Relationships': [
    'Peer Conflict',
    'Bullying',
    'Romantic Relationship Concerns',
    'Communication Difficulties',
    'Social Anxiety',
  ],
  'Family': [
    'Family Conflict',
    'Separation of Parents',
    'Financial Difficulties',
    'Lack of Family Support',
  ],
  'Career and Future Planning': [
    'Course Shifting Concerns',
    'Career Decision-Making',
    'Internship Concerns',
    'Employment Preparation',
  ],
  'Others': [
    'Health Concerns',
    'Financial Concerns',
  ],
}

export const CONCERN_DURATION_OPTIONS = [
  'Less than 1 month',
  '1–3 months',
  '4–6 months',
  'More than 6 months',
]

export const MKD_URGENCY_LEVELS = [
  {
    value: 'Low',
    label: 'Low',
    description: 'I only need advice or information.',
    color: 'sky',
  },
  {
    value: 'Moderate',
    label: 'Moderate',
    description: 'I would like counseling within the next few days.',
    color: 'amber',
  },
  {
    value: 'High',
    label: 'High',
    description: 'My concern is significantly affecting me.',
    color: 'orange',
  },
  {
    value: 'Immediate',
    label: 'Immediate',
    description: 'I need urgent assistance.',
    color: 'red',
  },
]

export const RISK_LEVEL_CONFIG = {
  Low:      { color: 'text-slate-600',  bg: 'bg-slate-100',  border: 'border-slate-200',  label: 'Low Risk' },
  Moderate: { color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-200',  label: 'Moderate Risk' },
  High:     { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200', label: 'High Risk' },
  Critical: { color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200',    label: 'Critical Risk' },
}