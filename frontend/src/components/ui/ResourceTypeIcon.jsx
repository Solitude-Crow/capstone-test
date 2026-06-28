// src/components/ui/ResourceTypeIcon.jsx
// Lucide iconography for guidance resource types (replaces emoji).
import { School, ClipboardList, Monitor, Link2, Users, BookOpen, Pin } from 'lucide-react'

const MAP = {
  workshop: School,
  seminar:  ClipboardList,
  webinar:  Monitor,
  referral: Link2,
  session:  Users,
  program:  BookOpen,
  other:    Pin,
}

export default function ResourceTypeIcon({ type, size = 16, className = '' }) {
  const Icon = MAP[type] || Pin
  return <Icon size={size} className={className} />
}
