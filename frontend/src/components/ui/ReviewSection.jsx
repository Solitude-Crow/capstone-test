// src/components/ui/ReviewSection.jsx
// Titled review card used in form confirmation steps.
// Default export: ReviewSection (card with uppercase header)
// Named export:   ReviewRow   (label + value row inside a section)

export function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-slate-500 font-medium shrink-0 w-28">{label}</span>
      <span className="text-sm text-slate-800 flex-1">{value}</span>
    </div>
  )
}

export default function ReviewSection({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-2.5">{children}</div>
    </div>
  )
}
