// src/components/ui/SectionCard.jsx
// Reusable titled section card.
// Props: title, action (React node), children, className

export default function SectionCard({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          {title && (
            <h2 className="font-display font-semibold text-slate-900 text-base sm:text-lg leading-tight">
              {title}
            </h2>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}