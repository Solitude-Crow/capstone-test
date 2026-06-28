// src/components/ui/StatCard.jsx
// Reusable stat card used across all dashboards.

export default function StatCard({ icon, label, count, colorBg, colorIcon, onClick }) {
  const Icon = icon
  const base = 'flex items-center gap-3 sm:gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5'
  return (
    <div
      className={`${base} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${colorBg}`}>
        <Icon size={20} className={colorIcon} />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display leading-none">{count}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  )
}