// src/components/ui/EmptyState.jsx
import { BrandLogo } from '@/components/ui/BrandLogo'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state relative overflow-hidden">
      {/* Faint GAB.AI watermark reinforces brand presence in blank states */}
      <BrandLogo
        variant="navy"
        size={160}
        className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04]"
        alt=""
      />
      <div className="relative flex flex-col items-center">
        <div className="empty-state-icon ring-1 ring-primary-100 bg-primary-50">
          {Icon ? (
            <Icon size={26} className="text-primary-400" />
          ) : (
            <BrandLogo variant="navy" size={30} />
          )}
        </div>
        <p className="font-display text-lg text-slate-700 mb-1">{title}</p>
        {description && <p className="text-sm text-slate-400 max-w-xs mb-5">{description}</p>}
        {action}
      </div>
    </div>
  )
}
