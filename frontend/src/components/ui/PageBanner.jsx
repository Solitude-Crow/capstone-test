// src/components/ui/PageBanner.jsx
//
// Responsive header banner. On phones the title block and action buttons stack
// vertically (so the buttons can never be pushed past the banner's right edge);
// from `sm` up they sit on one row with the actions aligned right. The action
// wrapper wraps its buttons and the title block is allowed to shrink (min-w-0)
// so long titles truncate/wrap instead of shoving the actions off-screen.
export default function PageBanner({ title, subtitle, action }) {
  return (
    <div className="page-banner mb-6 relative z-0">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-white/70 text-sm">{subtitle}</p>}
        </div>
        {action && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
