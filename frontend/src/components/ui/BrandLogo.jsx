// src/components/ui/BrandLogo.jsx
// Official GAB.AI brand mark + wordmark lockup.
//
// The mark (protective hands cradling two people + speech bubble) ships in
// two approved color variants:
//   • navy  (#1E3A5F) — for light backgrounds
//   • white (#F8FAFC) — for dark backgrounds (sidebar, banners, login panel)
//
// SVG keeps the logo crisp at every size and on every device.
import logoNavy from '@/assets/gab-logo-navy.svg'
import logoWhite from '@/assets/gab-logo-white.svg'

// ── Mark only ────────────────────────────────────────────────────────────────
export function BrandLogo({ variant = 'navy', size = 32, className = '', alt = 'GAB.AI' }) {
  const src = variant === 'white' ? logoWhite : logoNavy
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  )
}

// ── Full lockup: mark + "GAB.AI" wordmark + optional subtitle ─────────────────
// `tone` controls text color: "dark" (navy text, for light bg) | "light" (white
// text, for dark bg). The mark variant follows tone unless overridden.
export function BrandLockup({
  tone = 'dark',
  size = 36,
  subtitle = 'MKD Guidance Office',
  className = '',
  wordmarkClass = '',
}) {
  const light = tone === 'light'
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {/* Clear-space frame keeps breathing room around the mark */}
      <span
        className={`flex items-center justify-center rounded-xl shrink-0 ${
          light ? 'bg-white/15' : 'bg-primary-50'
        }`}
        style={{ width: size + 12, height: size + 12 }}
      >
        <BrandLogo variant={light ? 'white' : 'navy'} size={size} />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={`block font-display font-bold tracking-tight truncate ${
            light ? 'text-white' : 'text-primary-600'
          } ${wordmarkClass || 'text-lg'}`}
        >
          GAB<span className={light ? 'text-jade-400' : 'text-jade-500'}>.AI</span>
        </span>
        {subtitle && (
          <span className={`block text-[11px] truncate ${light ? 'text-white/55' : 'text-slate-400'}`}>
            {subtitle}
          </span>
        )}
      </span>
    </div>
  )
}

export default BrandLogo
