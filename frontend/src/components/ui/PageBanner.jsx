// src/components/ui/PageBanner.jsx
export default function PageBanner({ title, subtitle, action }) {
  return (
    <div className="page-banner mb-6 relative z-0">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-white/70 text-sm">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}