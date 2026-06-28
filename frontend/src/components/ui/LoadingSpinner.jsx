// src/components/ui/LoadingSpinner.jsx
import { BrandLogo } from '@/components/ui/BrandLogo'

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 'loading-sm', md: 'loading-md', lg: 'loading-lg' }[size] || 'loading-md'
  return <span className={`loading loading-spinner ${s} text-primary ${className}`} />
}

// Branded full-page loader — used for app boot / auth hydration and route splash.
export function FullPageLoader({ label = 'Loading your portal…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-base-100">
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-20 w-20 rounded-2xl bg-primary-100 animate-ping opacity-60" />
        <span className="relative flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-50 ring-1 ring-primary-100">
          <BrandLogo variant="navy" size={40} />
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-display font-bold text-primary-600 tracking-tight">
          GAB<span className="text-jade-500">.AI</span>
        </span>
        <span className="loading loading-dots loading-sm text-primary" />
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}
